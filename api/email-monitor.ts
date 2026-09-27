import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const authClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

const serviceClient =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey)
    : null;

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, code: "METHOD_NOT_ALLOWED" });
  }

  if (!authClient || !serviceClient) {
    return res.status(500).json({ success: false, code: "SUPABASE_NOT_CONFIGURED" });
  }

  const authorization =
    typeof req.headers?.authorization === "string"
      ? req.headers.authorization
      : "";

  if (!authorization.startsWith("Bearer ")) {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED" });
  }

  const token = authorization.slice("Bearer ".length).trim();
  const { data: userData, error: userError } = await authClient.auth.getUser(token);

  if (userError || !userData.user) {
    return res.status(401).json({ success: false, code: "INVALID_SESSION" });
  }

  const { data: privileged, error: roleError } = await authClient.rpc(
    "legacy_has_privileged_role",
  );

  if (roleError || privileged !== true) {
    return res.status(403).json({ success: false, code: "FORBIDDEN" });
  }

  const { data, error } = await serviceClient
    .from("email_queue")
    .select("id,status,attempts,error,created_at,updated_at,payload")
    .order("created_at", { ascending: false })
    .limit(20);

  if (error) {
    console.error("[EMAIL-MONITOR] queue read failed", error.message);
    return res.status(500).json({ success: false, code: "QUEUE_READ_FAILED" });
  }

  const queue = (data || []).map((item: any) => ({
    id: item.id,
    status: item.status,
    attempts: item.attempts,
    error: item.error,
    created_at: item.created_at,
    updated_at: item.updated_at,
    payload: {
      to: item.payload?.to || null,
      subject: item.payload?.subject || null,
    },
  }));

  return res.status(200).json({ success: true, queue });
}
