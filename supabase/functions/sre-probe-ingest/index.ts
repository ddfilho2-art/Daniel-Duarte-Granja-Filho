import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const encoder = new TextEncoder();
const allowedEndpoints = new Set(["homepage", "api-health"]);
const responseHeaders = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

function constantTimeEquals(actual: string, expected: string): boolean {
  const a = encoder.encode(actual);
  const b = encoder.encode(expected);
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i += 1) diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  return diff === 0;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: {
      ...responseHeaders,
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, OPTIONS",
      "access-control-allow-headers": "content-type, apikey, x-sre-probe-secret",
    }});
  }
  if (req.method !== "POST") return jsonResponse(405, { success: false, code: "METHOD_NOT_ALLOWED" });

  const expectedSecret = Deno.env.get("SRE_PROBE_SECRET") ?? "";
  const providedSecret = req.headers.get("x-sre-probe-secret") ?? "";
  if (!expectedSecret) return jsonResponse(503, { success: false, code: "SRE_PROBE_SECRET_NOT_CONFIGURED" });
  if (!constantTimeEquals(providedSecret, expectedSecret)) return jsonResponse(401, { success: false, code: "UNAUTHORIZED" });

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !serviceRoleKey) return jsonResponse(503, { success: false, code: "DATABASE_NOT_CONFIGURED" });

  let body: unknown;
  try {
    const raw = await req.text();
    if (raw.length > 16000) return jsonResponse(413, { success: false, code: "PAYLOAD_TOO_LARGE" });
    body = JSON.parse(raw);
  } catch {
    return jsonResponse(400, { success: false, code: "INVALID_JSON" });
  }

  const samples = (body as { samples?: unknown })?.samples;
  if (!Array.isArray(samples) || samples.length < 1 || samples.length > 10) return jsonResponse(400, { success: false, code: "INVALID_SAMPLES" });

  const now = Date.now();
  const rows: Array<Record<string, unknown>> = [];
  for (const sample of samples) {
    if (!sample || typeof sample !== "object") return jsonResponse(400, { success: false, code: "INVALID_SAMPLE" });
    const item = sample as Record<string, unknown>;
    if (typeof item.endpoint !== "string" || !allowedEndpoints.has(item.endpoint)) return jsonResponse(400, { success: false, code: "INVALID_ENDPOINT" });
    if (typeof item.latency_ms !== "number" || !Number.isInteger(item.latency_ms) || item.latency_ms < 0 || item.latency_ms > 60000) return jsonResponse(400, { success: false, code: "INVALID_LATENCY" });
    if (typeof item.success !== "boolean") return jsonResponse(400, { success: false, code: "INVALID_RESULT" });
    const statusCode = item.status_code === null ? null : item.status_code;
    if (statusCode !== null && (typeof statusCode !== "number" || !Number.isInteger(statusCode) || statusCode < 100 || statusCode > 599)) return jsonResponse(400, { success: false, code: "INVALID_STATUS_CODE" });
    if (item.success && (statusCode === null || statusCode < 200 || statusCode >= 300)) return jsonResponse(400, { success: false, code: "INCONSISTENT_RESULT" });
    if (typeof item.checked_at !== "string") return jsonResponse(400, { success: false, code: "INVALID_TIMESTAMP" });
    const checkedAt = Date.parse(item.checked_at);
    if (!Number.isFinite(checkedAt) || Math.abs(now - checkedAt) > 15 * 60 * 1000) return jsonResponse(400, { success: false, code: "TIMESTAMP_OUT_OF_RANGE" });
    rows.push({ endpoint: item.endpoint, status_code: statusCode, latency_ms: item.latency_ms, success: item.success, checked_at: new Date(checkedAt).toISOString(), source: "github_actions" });
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await admin.from("sre_probe_results").insert(rows);
  if (error) {
    console.error("[SRE-PROBE] insert failed", error.code ?? "unknown");
    return jsonResponse(503, { success: false, code: "PROBE_STORAGE_FAILED" });
  }
  return jsonResponse(200, { success: true, recorded: rows.length });
});
