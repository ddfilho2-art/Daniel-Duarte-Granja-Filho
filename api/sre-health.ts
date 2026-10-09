import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

export default async function handler(_req: any, res: any) {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (_req.method !== "GET" && _req.method !== "HEAD") {
    return res.status(405).json({ success: false, code: "METHOD_NOT_ALLOWED" });
  }
  if (!supabaseUrl || !supabaseAnonKey) {
    return res.status(503).json({ success: false, status: "unavailable", code: "HEALTH_CHECK_NOT_CONFIGURED" });
  }

  try {
    const client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data, error } = await client.rpc("sre_probe_health");
    if (error || data?.status !== "ok") {
      return res.status(503).json({ success: false, status: "unavailable", code: "DATABASE_HEALTH_CHECK_FAILED" });
    }
    return res.status(200).json({ success: true, status: "ok", checked_at: new Date().toISOString() });
  } catch {
    return res.status(503).json({ success: false, status: "unavailable", code: "HEALTH_CHECK_FAILED" });
  }
}
