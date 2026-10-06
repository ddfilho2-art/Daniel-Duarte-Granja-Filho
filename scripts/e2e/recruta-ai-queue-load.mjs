import "dotenv/config";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente local. Nunca coloque esses valores no Git.");
}

const db = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const prefix = `e2e-queue-${runId}-`;
const tenantId = crypto.randomUUID();
const total = Number(process.env.E2E_QUEUE_JOBS || 200);
const concurrency = Math.min(32, Math.max(4, Number(process.env.E2E_QUEUE_CONCURRENCY || 32)));

if (!Number.isInteger(total) || total < 1 || total > 1000) {
  throw new Error("E2E_QUEUE_JOBS deve estar entre 1 e 1000.");
}

const hash = () => crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");
const row = (i) => ({
  request_key: `${prefix}${String(i).padStart(4, "0")}`,
  actor_id: crypto.randomUUID(),
  candidato_id: crypto.randomUUID(),
  vaga_id: crypto.randomUUID(),
  candidatura_id: crypto.randomUUID(),
  prompt_version: "queue-load-test-v1",
  model: "synthetic-no-gemini",
  input_hash: hash(),
  tenant_id: tenantId,
  input_snapshot: { synthetic: true, run_id: runId, index: i },
  status: "queued",
  next_attempt_at: new Date().toISOString(),
});

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function claimBatch(size) {
  const results = await Promise.allSettled(
    Array.from({ length: size }, async () => {
      return must("claim_next_ai_analysis_request", db.rpc("claim_next_ai_analysis_request_for_tenant", { p_tenant_id: tenantId }));
    }),
  );
  const rejected = results.filter((result) => result.status === "rejected");
  if (rejected.length) {
    throw new Error(
      `claim batch falhou: ${rejected.map((result) => result.reason?.message || String(result.reason)).join(" | ")}`,
    );
  }
  return results.map((result) => result.value);
}

try {
  console.log(`=== Recruta AÍ — queue load test (${total} jobs / concurrency ${concurrency}) ===`);
  const startedAt = Date.now();

  const rows = Array.from({ length: total }, (_, i) => row(i));
  await must("insert synthetic queue", db.from("ai_analysis_requests").insert(rows));

  let claimed = [];
  let remaining = total;

  while (remaining > 0) {
    const batchSize = Math.min(concurrency, remaining);
    const batch = (await claimBatch(batchSize)).filter(Boolean);
    if (batch.length !== batchSize) {
      throw new Error(`claim retornou ${batch.length}/${batchSize} jobs no lote`);
    }
    claimed.push(...batch);

    const failures = await Promise.allSettled(batch.map((item) =>
      must("fail synthetic job", db.rpc("fail_ai_analysis_request", {
        p_request_key: item.request_key,
        p_claim_token: item.claim_token,
        p_error_code: "synthetic_load_test",
      }))
    ));
    const rejectedFailures = failures.filter((result) => result.status === "rejected");
    if (rejectedFailures.length) {
      throw new Error(
        `falha ao finalizar lote: ${rejectedFailures.map((result) => result.reason?.message || String(result.reason)).join(" | ")}`,
      );
    }

    remaining -= batch.length;
  }

  const uniqueKeys = new Set(claimed.map((x) => x.request_key));
  if (claimed.length !== total || uniqueKeys.size !== total) {
    throw new Error(`claims duplicados/perdidos: claimed=${claimed.length}, unique=${uniqueKeys.size}`);
  }

  const states = await must("state verification", db
    .from("ai_analysis_requests")
    .select("status")
    .like("request_key", `${prefix}%`));

  const failed = states.filter((x) => x.status === "failed").length;
  if (failed !== total) throw new Error(`estado final inesperado: failed=${failed}/${total}`);

  // Retry/backoff: a retryable failure must not become immediately claimable.
  const retryKey = `${prefix}retry`;
  await must("insert retry fixture", db.from("ai_analysis_requests").insert({
    ...row(total + 1),
    request_key: retryKey,
  }));
  const retryClaim = await must("claim retry fixture", db.rpc("claim_next_ai_analysis_request"));
  if (!retryClaim || retryClaim.request_key !== retryKey) {
    throw new Error("retry fixture não foi reivindicada");
  }
  await must("requeue retry fixture", db.rpc("requeue_ai_analysis_request", {
    p_request_key: retryKey,
    p_claim_token: retryClaim.claim_token,
    p_error_code: "synthetic_retry",
  }));
  const retryState = await must("retry verification", db
    .from("ai_analysis_requests")
    .select("status,next_attempt_at,attempt_count")
    .eq("request_key", retryKey)
    .single());
  if (retryState.status !== "queued" || new Date(retryState.next_attempt_at).getTime() <= Date.now()) {
    throw new Error("backoff não foi aplicado");
  }

  // Lease recovery: an expired processing lease must become claimable again.
  const leaseKey = `${prefix}lease`;
  const leaseToken = crypto.randomUUID();
  await must("insert lease fixture", db.from("ai_analysis_requests").insert({
    ...row(total + 2),
    request_key: leaseKey,
    status: "processing",
    claim_token: leaseToken,
    lease_expires_at: new Date(Date.now() - 1000).toISOString(),
    attempt_count: 1,
    next_attempt_at: new Date(Date.now() - 1000).toISOString(),
  }));
  const leaseClaim = await must("claim expired lease", db.rpc("claim_next_ai_analysis_request"));
  if (!leaseClaim || leaseClaim.request_key !== leaseKey) {
    throw new Error("lease expirado não foi recuperado");
  }
  await must("fail recovered lease", db.rpc("fail_ai_analysis_request", {
    p_request_key: leaseKey,
    p_claim_token: leaseClaim.claim_token,
    p_error_code: "synthetic_lease_recovery",
  }));

  console.log(JSON.stringify({
    ok: true,
    runId,
    total_jobs: total,
    concurrency,
    unique_claims: uniqueKeys.size,
    failed_after_claim: failed,
    retry_backoff: true,
    lease_recovery: true,
    elapsed_ms: Date.now() - startedAt,
    jobs_per_second: Number((total / ((Date.now() - startedAt) / 1000)).toFixed(2)),
  }, null, 2));
} finally {
  const { error } = await db
    .from("ai_analysis_requests")
    .delete()
    .like("request_key", `${prefix}%`);
  if (error) console.error("cleanup queue fixtures failed:", error.message);
  else console.log("Fixtures de fila removidas.");
}
