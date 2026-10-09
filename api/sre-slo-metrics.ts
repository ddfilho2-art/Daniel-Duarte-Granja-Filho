import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const authClient = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } })
  : null;

export default async function handler(req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, code: "METHOD_NOT_ALLOWED" });
  }
  if (!authClient) {
    return res.status(503).json({ success: false, code: "SUPABASE_NOT_CONFIGURED" });
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
    console.error("[SRE-SLO] Master authorization check failed", masterError.message);
    return res.status(503).json({ success: false, code: "AUTHORIZATION_CHECK_FAILED" });
  }
  if (isMaster !== true) {
    return res.status(403).json({ success: false, code: "PLATFORM_MASTER_REQUIRED" });
  }

  const { data, error } = await userClient.rpc("get_sre_slo_metrics");
  if (error) {
    console.error("[SRE-SLO] Metrics query failed", error.message);
    return res.status(503).json({ success: false, code: "SLO_METRICS_UNAVAILABLE" });
  }

  return res.status(200).json({ success: true, metrics: data });
}
