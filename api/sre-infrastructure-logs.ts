import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const managementToken = process.env.SUPABASE_ACCESS_TOKEN || "";
const projectRef = process.env.SUPABASE_PROJECT_REF || "dmzagrakkduddofkqjhg";

const authClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

const LOGS_SQL = `
select
  source,
  count() as events,
  countIf(
    positionCaseInsensitive(toString(event_message), 'error') > 0
    or positionCaseInsensitive(toString(event_message), 'exception') > 0
    or positionCaseInsensitive(toString(event_message), 'timeout') > 0
    or positionCaseInsensitive(toString(event_message), 'fatal') > 0
    or positionCaseInsensitive(toString(event_message), 'failed') > 0
  ) as suspected_errors,
  max(timestamp) as last_event
from logs
group by source
order by events desc
limit 30
`;

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, code: "METHOD_NOT_ALLOWED" });
  }
  if (!authClient) {
    return res.status(500).json({ success: false, code: "SUPABASE_NOT_CONFIGURED" });
  }

  const authorization = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED" });
  }
  const accessToken = authorization.slice("Bearer ".length).trim();
  const { data: userData, error: userError } = await authClient.auth.getUser(accessToken);
  if (userError || !userData.user) {
    return res.status(401).json({ success: false, code: "INVALID_SESSION" });
  }

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: isMaster, error: masterError } = await userClient.rpc("is_platform_master_admin");
  if (masterError) {
    console.error("[SRE-LOGS] master authorization check failed", masterError.message);
    return res.status(503).json({ success: false, code: "AUTHORIZATION_CHECK_FAILED" });
  }
  if (isMaster !== true) {
    return res.status(403).json({ success: false, code: "PLATFORM_MASTER_REQUIRED" });
  }

  if (!managementToken) {
    return res.status(503).json({ success: false, code: "INFRA_LOGS_NOT_CONFIGURED" });
  }

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  const params = new URLSearchParams({
    sql: LOGS_SQL,
    iso_timestamp_start: start.toISOString(),
    iso_timestamp_end: end.toISOString(),
  });

  try {
    const response = await fetch(
      `https://api.supabase.com/v1/projects/${encodeURIComponent(projectRef)}/analytics/endpoints/logs?${params.toString()}`,
      { method: "GET", headers: { Authorization: `Bearer ${managementToken}`, Accept: "application/json" } },
    );

    if (response.status === 401 || response.status === 403) {
      console.error("[SRE-LOGS] Management API denied log access", { status: response.status });
      return res.status(503).json({ success: false, code: "INFRA_LOGS_ACCESS_DENIED" });
    }
    if (response.status === 429) {
      return res.status(503).json({ success: false, code: "INFRA_LOGS_RATE_LIMITED" });
    }
    if (!response.ok) {
      console.error("[SRE-LOGS] Management API request failed", { status: response.status });
      return res.status(502).json({ success: false, code: "INFRA_LOGS_UPSTREAM_FAILED" });
    }

    const payload = await response.json();
    if (payload?.error) {
      console.error("[SRE-LOGS] Management API returned a query error");
      return res.status(502).json({ success: false, code: "INFRA_LOGS_QUERY_FAILED" });
    }
    const rows = Array.isArray(payload?.result)
      ? payload.result
      : Array.isArray(payload?.result?.result)
        ? payload.result.result
        : [];

    const sources = rows.map((row: any) => {
      const rawLastEvent = typeof row.last_event === "string" ? row.last_event : "";
      const normalizedTimestamp = rawLastEvent && !/(Z|[+-]\d{2}:\d{2})$/i.test(rawLastEvent)
        ? `${rawLastEvent}Z`
        : rawLastEvent;
      const parsedTimestamp = normalizedTimestamp ? new Date(normalizedTimestamp) : null;
      return {
        source: String(row.source || "unknown"),
        events: Math.max(0, Number(row.events) || 0),
        suspected_errors: Math.max(0, Number(row.suspected_errors) || 0),
        last_event: parsedTimestamp && Number.isFinite(parsedTimestamp.getTime()) ? parsedTimestamp.toISOString() : null,
      };
    });

    return res.status(200).json({
      success: true,
      window: { start: start.toISOString(), end: end.toISOString() },
      sources,
    });
  } catch (error: unknown) {
    console.error("[SRE-LOGS] Management API request threw", error instanceof Error ? error.message : "unknown_error");
    return res.status(502).json({ success: false, code: "INFRA_LOGS_UPSTREAM_FAILED" });
  }
}
