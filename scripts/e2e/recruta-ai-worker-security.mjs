import "dotenv/config";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const baseUrl = supabaseUrl ? supabaseUrl.replace(/\/$/, "") : "";
const workerUrl =
  process.env.CANDIDATE_ANALYSIS_WORKER_URL ||
  (baseUrl ? `${baseUrl}/functions/v1/candidate-analysis-worker` : "");

if (!workerUrl || !anonKey) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_ANON_KEY no ambiente.");
}

async function call(label, authorization) {
  const headers = {
    "Content-Type": "application/json",
    apikey: anonKey,
  };

  if (authorization !== null) {
    headers.Authorization = authorization;
  }

  const response = await fetch(workerUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({ max_jobs: 1 }),
    signal: AbortSignal.timeout(30000),
  });

  const body = await response.json().catch(() => ({}));

  console.log(JSON.stringify({
    label,
    status: response.status,
    error: body?.error ?? null,
    success: body?.success ?? null,
  }));

  if (response.status !== 401) {
    throw new Error(
      `${label}: worker aceitou uma chamada sem autorização de service_role (HTTP ${response.status})`,
    );
  }
}

console.log("=== Recruta AÍ — smoke test de autorização do worker ===");
await call("sem Authorization", null);
await call("Bearer com chave anon", `Bearer ${anonKey}`);
console.log("OK: o worker rejeita chamadas que não usam a autorização de service_role.");
