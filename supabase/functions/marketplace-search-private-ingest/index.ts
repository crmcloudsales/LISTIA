import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "listia-marketplace-search-ingest";
const REPOSITORY = "crmcloudsales/LISTIA";
const OWNER = "crmcloudsales";
const REF = "refs/heads/main";
const WORKFLOW_REF = "crmcloudsales/LISTIA/.github/workflows/listia-real-estate-search-import.yml@refs/heads/main";
const MAX_BATCH = 250;
const MAX_BODY_BYTES = 6_000_000;
const GITHUB_JWKS = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function httpsUrl(value: unknown): boolean {
  if (typeof value !== "string" || value.length > 3000) return false;
  try { return new URL(value).protocol === "https:"; } catch { return false; }
}

function saneText(value: unknown, max: number): boolean {
  return value == null || (typeof value === "string" && value.length <= max);
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });
  const length = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  const auth = req.headers.get("authorization") || "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return json(401, { error: "github_oidc_required" });

  let claims: Record<string, unknown>;
  try {
    const verified = await jwtVerify(match[1], GITHUB_JWKS, {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["RS256"],
      clockTolerance: 5,
    });
    claims = verified.payload as Record<string, unknown>;
  } catch (error) {
    console.error("marketplace_search_oidc_verify_failed", String(error));
    return json(401, { error: "github_oidc_invalid" });
  }

  const eventName = String(claims.event_name || "");
  const trusted = claims.repository === REPOSITORY && claims.repository_owner === OWNER &&
    claims.ref === REF && claims.workflow_ref === WORKFLOW_REF &&
    (eventName === "workflow_dispatch" || eventName === "push" || eventName === "schedule");
  if (!trusted) return json(403, { error: "github_oidc_claims_not_allowed" });

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return json(400, { error: "invalid_json" }); }
  const batch = body.batch;
  if (!Array.isArray(batch) || batch.length < 1 || batch.length > MAX_BATCH) {
    return json(400, { error: "invalid_batch_size", max_batch: MAX_BATCH });
  }
  const seedRef = typeof body.seed_ref === "string" ? body.seed_ref.slice(0, 3000) : "";
  const channel = typeof body.channel === "string" ? body.channel.slice(0, 80) : "real_estate_search";

  for (const item of batch) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return json(400, { error: "invalid_item" });
    const row = item as Record<string, unknown>;
    const listing = (row.listing && typeof row.listing === "object" && !Array.isArray(row.listing)) ? row.listing as Record<string, unknown> : row;
    const pageUrl = listing.page_url ?? listing.external_url;
    if (!httpsUrl(pageUrl) || typeof listing.title !== "string" || !listing.title.trim() || listing.title.length > 300) {
      return json(400, { error: "listing_requires_https_page_url_and_title" });
    }
    if (!saneText(listing.description, 12000) || !saneText(listing.summary, 3000)) return json(400, { error: "listing_text_too_large" });
    const contacts = row.contacts;
    if (contacts != null && !Array.isArray(contacts)) return json(400, { error: "contacts_must_be_array" });
    if (Array.isArray(contacts) && contacts.length > 20) return json(400, { error: "too_many_contacts" });
    for (const c of Array.isArray(contacts) ? contacts : []) {
      if (!c || typeof c !== "object" || Array.isArray(c)) return json(400, { error: "invalid_contact" });
      const x = c as Record<string, unknown>;
      for (const [key, max] of [["email",320],["phone",80],["whatsapp",80],["person_name",240],["company_name",240],["display_name",240],["website_url",3000],["evidence_url",3000]] as const) {
        if (!saneText(x[key], max)) return json(400, { error: "contact_field_too_large", field: key });
      }
      if (x.evidence_url != null && x.evidence_url !== "" && !httpsUrl(x.evidence_url)) return json(400, { error: "contact_evidence_must_be_https" });
    }
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(500, { error: "runtime_not_configured" });
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  const { data, error } = await admin.rpc("ingest_marketplace_search_batch", {
    p_seed_ref: seedRef || null,
    p_channel: channel || "real_estate_search",
    p_items: batch,
  });
  if (error) {
    console.error("marketplace_search_ingest_failed", { code: error.code, message: error.message, run_id: claims.run_id });
    return json(500, { error: "ingest_failed", code: error.code || null });
  }
  return json(200, {
    ok: true,
    workflow_run_id: String(claims.run_id || ""),
    workflow_sha: String(claims.workflow_sha || ""),
    result: data,
  });
});
