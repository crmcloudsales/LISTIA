import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "listia-qroo-direct-ingest";
const REPOSITORY = "crmcloudsales/LISTIA";
const OWNER = "crmcloudsales";
const REF = "refs/heads/main";
const WORKFLOW_REF = "crmcloudsales/LISTIA/.github/workflows/listia-qroo-direct-sources.yml@refs/heads/main";
const MAX_BATCH = 200;
const MAX_BODY_BYTES = 4_000_000;
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

function sameConfiguredHost(sourceUrl: string, pageUrl: string): boolean {
  try {
    const source = new URL(sourceUrl);
    const page = new URL(pageUrl);
    const norm = (h: string) => h.toLowerCase().replace(/^www\./, "");
    return page.protocol === "https:" && norm(page.hostname) === norm(source.hostname);
  } catch {
    return false;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST" && req.method !== "GET") return json(405, { error: "method_not_allowed" });
  const length = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return json(413, { error: "payload_too_large" });

  const authorization = req.headers.get("authorization") || "";
  const match = authorization.match(/^Bearer\s+(.+)$/i);
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
    console.error("qroo_direct_oidc_verify_failed", String(error));
    return json(401, { error: "github_oidc_invalid" });
  }

  const eventName = String(claims.event_name || "");
  const trusted = claims.repository === REPOSITORY && claims.repository_owner === OWNER &&
    claims.ref === REF && claims.workflow_ref === WORKFLOW_REF &&
    (eventName === "workflow_dispatch" || eventName === "schedule" || eventName === "push");
  if (!trusted) return json(403, { error: "github_oidc_claims_not_allowed" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) return json(500, { error: "runtime_not_configured" });
  const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false, autoRefreshToken: false } });

  if (req.method === "GET") {
    const requested = Number(new URL(req.url).searchParams.get("limit") || "100");
    const limit = Number.isFinite(requested) ? Math.max(1, Math.min(Math.trunc(requested), 200)) : 100;
    const { data, error } = await admin.rpc("list_qroo_direct_sources", { p_limit: limit });
    if (error) {
      console.error("qroo_direct_source_list_failed", { code: error.code, message: error.message, run_id: claims.run_id });
      return json(500, { error: "source_list_failed", code: error.code || null });
    }
    return json(200, { ok: true, territory: "Quintana Roo", sources: data, run_id: String(claims.run_id || "") });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }
  const batch = (body as { batch?: unknown })?.batch;
  if (!Array.isArray(batch) || batch.length < 1 || batch.length > MAX_BATCH) return json(400, { error: "invalid_batch_size", max_batch: MAX_BATCH });

  for (const item of batch) {
    if (!item || typeof item !== "object") return json(400, { error: "invalid_row" });
    const row = item as Record<string, unknown>;
    const sourceUrl = String(row.source_url || "");
    const pageUrl = String(row.page_url || "");
    const cover = String(row.cover_image_url || "");
    const gallery = Array.isArray(row.gallery) ? row.gallery : [];
    if (!sourceUrl || !pageUrl || !cover || gallery.length < 1 || !sameConfiguredHost(sourceUrl, pageUrl)) {
      return json(400, { error: "row_provenance_or_media_invalid" });
    }
  }

  const { data, error } = await admin.rpc("ingest_qroo_direct_payload", { p_payload: batch });
  if (error) {
    console.error("qroo_direct_rpc_failed", { code: error.code, message: error.message, run_id: claims.run_id, batch_size: batch.length });
    return json(500, { error: "ingest_failed", code: error.code || null });
  }

  return json(200, {
    ok: true,
    run_id: String(claims.run_id || ""),
    workflow_sha: String(claims.workflow_sha || ""),
    result: data,
  });
});
