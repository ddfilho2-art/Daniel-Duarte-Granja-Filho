import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const authClient = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
const adminClient = supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }) : null;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).json({ success: false, code: "METHOD_NOT_ALLOWED" });
  if (!authClient || !adminClient) return res.status(500).json({ success: false, code: "SUPABASE_NOT_CONFIGURED" });

  const authorization = typeof req.headers?.authorization === "string" ? req.headers.authorization : "";
  if (!authorization.startsWith("Bearer ")) return res.status(401).json({ success: false, code: "UNAUTHORIZED" });
  const tenantId = typeof req.headers?.["x-tenant-id"] === "string" ? req.headers["x-tenant-id"].trim() : "";
  if (!UUID_PATTERN.test(tenantId)) return res.status(400).json({ success: false, code: "TENANT_REQUIRED" });

  const { data: userData, error: userError } = await authClient.auth.getUser(authorization.slice("Bearer ".length).trim());
  if (userError || !userData.user) return res.status(401).json({ success: false, code: "INVALID_SESSION" });

  const [{ data: membership, error: membershipError }, { data: tenant, error: tenantError }] = await Promise.all([
    adminClient.from("tenant_memberships").select("tenant_id,roles,status").eq("user_id", userData.user.id).eq("tenant_id", tenantId).eq("status", "active").maybeSingle(),
    adminClient.from("tenants").select("id,kind,status").eq("id", tenantId).maybeSingle(),
  ]);
  if (membershipError || tenantError) {
    console.error("[EMAIL-MONITOR] authorization lookup failed", { membershipError: membershipError?.message, tenantError: tenantError?.message });
    return res.status(503).json({ success: false, code: "AUTHORIZATION_CHECK_FAILED" });
  }

  const roles = Array.isArray(membership?.roles) ? membership.roles : [];
  if (!membership || !roles.some((role: string) => ["tenant_admin", "tenant_admin_substitute"].includes(role)) || tenant?.kind !== "employer" || tenant?.status !== "active") {
    return res.status(403).json({ success: false, code: "TENANT_ADMIN_REQUIRED" });
  }

  const [{ data: queue, error: queueError }, pending, sent, failed] = await Promise.all([
    adminClient.from("email_queue").select("id,status,attempts,error,created_at,updated_at,payload").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(20),
    adminClient.from("email_queue").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "pending"),
    adminClient.from("email_queue").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "sent"),
    adminClient.from("email_queue").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId).eq("status", "failed"),
  ]);
  if (queueError || pending.error || sent.error || failed.error) {
    console.error("[EMAIL-MONITOR] queue read failed", { queue: queueError?.message, pending: pending.error?.message, sent: sent.error?.message, failed: failed.error?.message });
    return res.status(500).json({ success: false, code: "QUEUE_READ_FAILED" });
  }

  const safeQueue = (queue || []).map((item: any) => ({
    id: item.id, status: item.status, attempts: item.attempts, error: item.error,
    created_at: item.created_at, updated_at: item.updated_at,
    payload: { to: item.payload?.to || null, subject: item.payload?.subject || null },
  }));
  return res.status(200).json({ success: true, queue: safeQueue, summary: { pending: pending.count || 0, sent: sent.count || 0, failed: failed.count || 0 } });
}
