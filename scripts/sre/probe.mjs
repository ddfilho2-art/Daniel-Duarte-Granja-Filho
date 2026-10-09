const baseUrl = (process.env.PROBE_BASE_URL || "https://daniel-duarte-granja-filho.vercel.app").replace(/\/$/, "");
const supabaseUrl = (process.env.SUPABASE_URL || "https://dmzagrakkduddofkqjhg.supabase.co").replace(/\/$/, "");
const anonKey = process.env.SUPABASE_ANON_KEY || "";
const probeSecret = process.env.SRE_PROBE_SECRET || "";

if (!anonKey || !probeSecret) {
  throw new Error("Missing required GitHub Actions secrets: SUPABASE_ANON_KEY and SRE_PROBE_SECRET.");
}

async function probe(endpoint, url) {
  const started = performance.now();
  let statusCode = null;
  let success = false;
  try {
    const response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: { "user-agent": "RecrutaAI-SyntheticProbe/1.0" },
    });
    statusCode = response.status;
    const contentType = response.headers.get("content-type") || "";
    const body = await response.text();
    success = response.ok && (
      endpoint === "homepage"
        ? contentType.toLowerCase().includes("text/html") && body.length > 0
        : (() => {
            try {
              const json = JSON.parse(body);
              return json.success === true && json.status === "ok";
            } catch {
              return false;
            }
          })()
    );
  } catch {
    // Never persist raw network exceptions or URLs with query strings.
    success = false;
  }

  return {
    endpoint,
    status_code: statusCode,
    latency_ms: Math.min(60000, Math.max(0, Math.round(performance.now() - started))),
    success,
    checked_at: new Date().toISOString(),
  };
}

const samples = [
  await probe("homepage", baseUrl + "/"),
  await probe("api-health", baseUrl + "/api/sre-health"),
];

const response = await fetch(supabaseUrl + "/functions/v1/sre-probe-ingest", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    apikey: anonKey,
    "x-sre-probe-secret": probeSecret,
  },
  body: JSON.stringify({ samples }),
  signal: AbortSignal.timeout(15000),
});

if (!response.ok) {
  const safeBody = (await response.text()).slice(0, 300);
  throw new Error("SRE probe ingestion failed with HTTP " + response.status + ": " + safeBody);
}

const result = await response.json();
console.log(JSON.stringify({
  recorded: result.recorded,
  probes: samples.map(({ endpoint, status_code, latency_ms, success }) => ({
    endpoint, status_code, latency_ms, success,
  })),
}));

