import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { createRemoteJWKSet, jwtVerify } from "npm:jose@5.10.0";

const ISSUER = "https://token.actions.githubusercontent.com";
const AUDIENCE = "listia-qroo-ingest";
const REPOSITORY = "crmcloudsales/LISTIA";
const OWNER = "crmcloudsales";
const REF = "refs/heads/main";
const WORKFLOW_REF = "crmcloudsales/LISTIA/.github/workflows/listia-qroo-image-first-crawl.yml@refs/heads/main";
const MAX_BATCH = 250;
const MAX_BODY_BYTES = 4_000_000;

const GITHUB_JWKS = createRemoteJWKSet(
  new URL("https://token.actions.githubusercontent.com/.well-known/jwks"),
);

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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const length = Number(req.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) {
    return json(413, { error: "payload_too_large" });
  }

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
    console.error("qroo_private_ingest_oidc_verify_failed", String(error));
    return json(401, { error: "github_oidc_invalid" });
  }

  const eventName = String(claims.event_name || "");
  const trusted =
    claims.repository === REPOSITORY &&
    claims.repository_owner === OWNER &&
    claims.ref === REF &&
    claims.workflow_ref === WORKFLOW_REF &&
    (eventName === "workflow_dispatch" || eventName === "schedule" || eventName === "push");

  if (!trusted) {
    console.error("qroo_private_ingest_untrusted_claims", {
      repository: claims.repository,
      repository_owner: claims.repository_owner,
      ref: claims.ref,
      workflow_ref: claims.workflow_ref,
      event_name: claims.event_name,
      run_id: claims.run_id,
    });
    return json(403, { error: "github_oidc_claims_not_allowed" });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const batch = (body as { batch?: unknown })?.batch;
  if (!Array.isArray(batch) || batch.length < 1 || batch.length > MAX_BATCH) {
    return json(400, { error: "invalid_batch_size", max_batch: MAX_BATCH });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRole) {
    console.error("qroo_private_ingest_missing_supabase_runtime_secrets");
    return json(500, { error: "runtime_not_configured" });
  }

  const admin = createClient(supabaseUrl, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await admin.rpc("ingest_qroo_payload", { p_payload: batch });
  if (error) {
    console.error("qroo_private_ingest_rpc_failed", {
      code: error.code,
      message: error.message,
      run_id: claims.run_id,
      workflow_sha: claims.workflow_sha,
      batch_size: batch.length,
    });
    return json(500, { error: "ingest_failed", code: error.code || null });
  }

  return json(200, {
    ok: true,
    run_id: String(claims.run_id || ""),
    workflow_sha: String(claims.workflow_sha || ""),
    result: data,
  });
});
