import { createClient } from "npm:@supabase/supabase-js@2.101.1";

type Action =
  | { action: "list_admins"; tenantId?: string }
  | { action: "history"; tenantId?: string }
  | {
      action: "add_admin";
      tenantId?: string;
      userId?: string;
      email?: string;
      nome?: string;
      password?: string;
      effectiveAt?: string;
      justification?: string;
    }
  | {
      action: "replace_admin";
      tenantId?: string;
      previousUserId?: string;
      userId?: string;
      email?: string;
      nome?: string;
      password?: string;
      effectiveAt?: string;
      justification?: string;
    }
  | {
      action: "revoke_admin";
      tenantId?: string;
      userId?: string;
      effectiveAt?: string;
      justification?: string;
    }
  | {
      action: "register_attachment";
      tenantId?: string;
      operationId?: string;
      storagePath?: string;
      fileName?: string;
      mimeType?: string;
      sizeBytes?: number;
    };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function env(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error("missing_secret:" + name);
  return value;
}

function validPassword(value: string): boolean {
  return value.length >= 8 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value);
}

const DEFAULT_ORIGINS = new Set([
  "https://daniel-duarte-granja-filho.vercel.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function corsHeaders(request: Request): Record<string, string> | null {
  const origin = request.headers.get("Origin");
  const allowed = new Set(DEFAULT_ORIGINS);
  for (const value of (Deno.env.get("ALLOWED_ORIGINS") || "").split(",")) {
    const item = value.trim();
    if (item) allowed.add(item);
  }
  if (!origin) {
    return {
      "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, idempotency-key",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }
  if (!allowed.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, idempotency-key",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function response(body: unknown, status: number, cors: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...cors,
    },
  });
}

async function bodyOf<T>(request: Request): Promise<T> {
  const text = await request.text();
  if (text.length > 32_000) throw new Error("payload_too_large");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("invalid_json");
  }
}

function requestId(): string {
  return crypto.randomUUID();
}

async function assertPlatformAdmin(
  request: Request,
  admin: ReturnType<typeof createClient>,
  userClient: ReturnType<typeof createClient>,
): Promise<string> {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) throw new Error("unauthorized");

  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) throw new Error("unauthorized");

  const { data: role } = await admin
    .from("platform_user_roles")
    .select("id")
    .eq("user_id", data.user.id)
    .eq("role", "platform_master_admin")
    .eq("active", true)
    .is("revoked_at", null)
    .maybeSingle();

  if (!role) throw new Error("platform_master_admin_required");
  return data.user.id;
}

function tenantIdOf(value: unknown): string {
  const tenantId = String(value || "").trim();
  if (!UUID.test(tenantId)) throw new Error("invalid_tenant_id");
  return tenantId;
}

function effectiveDateOf(value: unknown): string {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) throw new Error("invalid_effective_date");
  return date.toISOString();
}

async function ensureUserProfile(
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string,
  nome: string,
  createdAuthUser: boolean,
): Promise<void> {
  const { data: existing, error } = await admin
    .from("users")
    .select("id, perfil, status")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;

  if (!existing) {
    const { error: profileError } = await admin.from("users").insert({
      id: userId,
      uid: userId,
      nome,
      email,
      login: email.split("@")[0],
      login_lower: email.split("@")[0].toLowerCase(),
      perfil: "Admin",
      status: "Ativo",
      updated_at: new Date().toISOString(),
    });
    if (profileError) {
      if (createdAuthUser) {
        await admin.auth.admin.deleteUser(userId).catch(() => undefined);
      }
      throw profileError;
    }
  }
}

async function resolveUser(
  admin: ReturnType<typeof createClient>,
  body: Extract<Action, { action: "add_admin" | "replace_admin" }>,
): Promise<{ userId: string; createdAuthUser: boolean }> {
  if (body.userId) {
    if (!UUID.test(body.userId)) throw new Error("invalid_user_id");
    const { data, error } = await admin.auth.admin.getUserById(body.userId);
    if (error || !data.user) throw new Error("auth_user_not_found");
    const email = data.user.email || "";
    if (!EMAIL.test(email)) throw new Error("user_email_required");
    await ensureUserProfile(admin, data.user.id, email, body.nome?.trim() || email.split("@")[0], false);
    return { userId: data.user.id, createdAuthUser: false };
  }

  const email = String(body.email || "").trim().toLowerCase();
  const nome = String(body.nome || "").trim();
  const password = String(body.password || "");

  if (!EMAIL.test(email) || nome.length < 2 || nome.length > 160 || !validPassword(password)) {
    throw new Error("invalid_admin_user_data");
  }

  const { data: existingProfile, error: profileLookupError } = await admin
    .from("users")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();
  if (profileLookupError) throw profileLookupError;

  if (existingProfile?.id) {
    const { data, error } = await admin.auth.admin.getUserById(existingProfile.id);
    if (error || !data.user) throw new Error("auth_user_not_found");
    await ensureUserProfile(admin, data.user.id, email, nome, false);
    return { userId: data.user.id, createdAuthUser: false };
  }

  const { data: created, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome, perfil: "Admin" },
  });

  if (error || !created.user) {
    throw new Error(error?.message || "AUTH_CREATE_FAILED");
  }

  await ensureUserProfile(admin, created.user.id, email, nome, true);
  return { userId: created.user.id, createdAuthUser: true };
}

async function listAdmins(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
) {
  const { data: memberships, error } = await admin
    .from("tenant_memberships")
    .select("id, user_id, roles, status, activated_at, revoked_at, created_at, updated_at")
    .eq("tenant_id", tenantId)
    .contains("roles", ["tenant_admin"])
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = [...new Set((memberships || []).map((row) => row.user_id))];
  if (!ids.length) return [];

  const { data: users, error: usersError } = await admin
    .from("users")
    .select("id, nome, email, login, perfil, status")
    .in("id", ids);
  if (usersError) throw usersError;

  const byId = new Map((users || []).map((user) => [user.id, user]));
  return (memberships || []).map((membership) => ({
    ...membership,
    user: byId.get(membership.user_id) || null,
  }));
}

async function listHistory(
  admin: ReturnType<typeof createClient>,
  tenantId: string,
) {
  const { data: operations, error } = await admin
    .from("tenant_admin_operations")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const ids = [...new Set(
    (operations || [])
      .flatMap((row) => [row.target_user_id, row.previous_user_id, row.actor_id])
      .filter(Boolean),
  )];

  if (!ids.length) return operations || [];

  const { data: users, error: usersError } = await admin
    .from("users")
    .select("id, nome, email")
    .in("id", ids);
  if (usersError) throw usersError;

  const byId = new Map((users || []).map((user) => [user.id, user]));
  return (operations || []).map((operation) => ({
    ...operation,
    target_user: operation.target_user_id ? byId.get(operation.target_user_id) || null : null,
    previous_user: operation.previous_user_id ? byId.get(operation.previous_user_id) || null : null,
    actor: operation.actor_id ? byId.get(operation.actor_id) || null : null,
  }));
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const id = requestId();

  if (!cors) return new Response("Origin not allowed", { status: 403 });
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return response({ success: false, code: "METHOD_NOT_ALLOWED", requestId: id }, 405, cors);

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return response({ success: false, code: "UNAUTHORIZED", requestId: id }, 401, cors);
    }

    const supabaseUrl = env("SUPABASE_URL");
    const anonKey = env("SUPABASE_ANON_KEY");
    const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
    const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const actorId = await assertPlatformAdmin(request, admin, userClient);
    const body = await bodyOf<Action>(request);

    if (body.action === "list_admins") {
      const tenantId = tenantIdOf(body.tenantId);
      return response({ success: true, data: await listAdmins(admin, tenantId), requestId: id }, 200, cors);
    }

    if (body.action === "history") {
      const tenantId = tenantIdOf(body.tenantId);
      return response({ success: true, data: await listHistory(admin, tenantId), requestId: id }, 200, cors);
    }

    if (body.action === "add_admin" || body.action === "replace_admin") {
      const tenantId = tenantIdOf(body.tenantId);
      const justification = String(body.justification || "").trim();
      if (justification.length < 5 || justification.length > 2000) throw new Error("justification_required");
      const effectiveAt = effectiveDateOf(body.effectiveAt);

      if (body.action === "replace_admin") {
        if (!body.previousUserId || !UUID.test(body.previousUserId)) throw new Error("previous_admin_required");
      }

      const { userId, createdAuthUser } = await resolveUser(admin, body);
      try {
        const { data, error } = await admin.rpc("record_tenant_admin_operation", {
          p_actor_id: actorId,
          p_tenant_id: tenantId,
          p_operation_type: body.action === "add_admin" ? "add" : "replace",
          p_target_user_id: userId,
          p_previous_user_id: body.action === "replace_admin" ? body.previousUserId : null,
          p_effective_at: effectiveAt,
          p_justification: justification,
        });

        if (error) throw error;

        return response({ success: true, data, requestId: id }, 200, cors);
      } catch (error) {
        if (createdAuthUser) {
          await admin.auth.admin.deleteUser(userId).catch(() => undefined);
          await admin.from("users").delete().eq("id", userId).catch(() => undefined);
        }
        throw error;
      }
    }

    if (body.action === "revoke_admin") {
      const tenantId = tenantIdOf(body.tenantId);
      if (!body.userId || !UUID.test(body.userId)) throw new Error("target_admin_required");
      const justification = String(body.justification || "").trim();
      if (justification.length < 5 || justification.length > 2000) throw new Error("justification_required");
      const effectiveAt = effectiveDateOf(body.effectiveAt);

      const { data, error } = await admin.rpc("record_tenant_admin_operation", {
        p_actor_id: actorId,
        p_tenant_id: tenantId,
        p_operation_type: "revoke",
        p_target_user_id: body.userId,
        p_previous_user_id: null,
        p_effective_at: effectiveAt,
        p_justification: justification,
      });
      if (error) throw error;

      return response({ success: true, data, requestId: id }, 200, cors);
    }

    if (body.action === "register_attachment") {
      const tenantId = tenantIdOf(body.tenantId);
      const operationId = String(body.operationId || "").trim();
      const storagePath = String(body.storagePath || "").trim();
      const fileName = String(body.fileName || "").trim();
      const mimeType = body.mimeType ? String(body.mimeType).trim() : null;
      const sizeBytes = Number(body.sizeBytes || 0);

      if (!UUID.test(operationId) || !storagePath || !fileName || sizeBytes < 0 || sizeBytes > 10485760) {
        throw new Error("invalid_attachment");
      }

      const { data: operation, error: operationError } = await admin
        .from("tenant_admin_operations")
        .select("id, tenant_id")
        .eq("id", operationId)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (operationError) throw operationError;
      if (!operation) throw new Error("operation_not_found");

      const { data, error } = await admin
        .from("tenant_admin_operation_attachments")
        .insert({
          operation_id: operationId,
          storage_path: storagePath,
          file_name: fileName,
          mime_type: mimeType,
          size_bytes: sizeBytes,
          uploaded_by: actorId,
        })
        .select()
        .single();
      if (error) throw error;

      return response({ success: true, data, requestId: id }, 201, cors);
    }

    throw new Error("INVALID_ACTION");
  } catch (error) {
    const raw = error instanceof Error ? error.message : String(error);
    const code = raw === "unauthorized" ? "UNAUTHORIZED"
      : raw === "platform_master_admin_required" ? "FORBIDDEN"
      : raw === "INVALID_ACTION" ? "INVALID_ACTION"
      : raw.startsWith("duplicate key") ? "CONFLICT"
      : "INVALID_REQUEST";

    const status = code === "FORBIDDEN" ? 403 : code === "UNAUTHORIZED" ? 401 : 400;
    console.error(JSON.stringify({ event: "tenant_admin_management_failed", requestId: id, error: raw.slice(0, 300) }));
    return response({ success: false, code, message: raw, requestId: id }, status, cors);
  }
});