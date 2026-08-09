import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import {
  corsHeaders,
  jsonResponse,
  readJsonBody,
  requestId,
  sha256,
} from "../_shared/http.ts";

type AdminAction =
  | {
      action: "create";
      nome?: string;
      email?: string;
      login?: string;
      password?: string;
    }
  | {
      action: "update";
      userId?: string;
      nome?: string;
      email?: string;
    }
  | {
      action: "reset_password";
      userId?: string;
      password?: string;
    }
  | {
      action: "set_status";
      userId?: string;
      status?: "Ativo" | "Congelado" | "Inativo" | "cancelado";
    };

type AdminClient = ReturnType<typeof createClient>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_secret:${name}`);
  return value;
}

function validPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value)
  );
}

async function targetRh(admin: AdminClient, userId: string) {
  const { data, error } = await admin
    .from("users")
    .select("id, uid, nome, email, login, perfil, status")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error("USER_NOT_FOUND");
  if (String(data.perfil || "").toLocaleLowerCase("pt-BR") !== "rh") {
    throw new Error("INVALID_PROFILE");
  }

  return data;
}

async function audit(
  admin: AdminClient,
  actorId: string,
  action: string,
  targetId: string | null,
  details: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from("edge_audit_logs").insert({
    actor_id: actorId,
    action,
    resource_type: "user",
    resource_id: targetId,
    details,
  });

  if (error) console.error("admin_users_audit_failed", error.code);
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const currentRequestId = requestId(request);

  if (!cors) {
    return jsonResponse(
      { success: false, code: "ORIGIN_NOT_ALLOWED", requestId: currentRequestId },
      403,
    );
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return jsonResponse(
      { success: false, code: "METHOD_NOT_ALLOWED", requestId: currentRequestId },
      405,
      cors,
    );
  }

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse(
        { success: false, code: "UNAUTHORIZED", requestId: currentRequestId },
        401,
        cors,
      );
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const body = await readJsonBody<AdminAction>(request);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse(
        { success: false, code: "UNAUTHORIZED", requestId: currentRequestId },
        401,
        cors,
      );
    }

    const { data: actor, error: actorError } = await admin
      .from("users")
      .select("id, uid, perfil, status")
      .or(`id.eq.${authData.user.id},uid.eq.${authData.user.id}`)
      .limit(1)
      .maybeSingle();

    if (
      actorError ||
      !actor ||
      String(actor.perfil || "").toLocaleLowerCase("pt-BR") !== "admin" ||
      String(actor.status || "").toLocaleLowerCase("pt-BR") !== "ativo"
    ) {
      return jsonResponse(
        { success: false, code: "FORBIDDEN", requestId: currentRequestId },
        403,
        cors,
      );
    }

    const subjectHash = await sha256(`admin-users:${authData.user.id}`);
    const { data: limit, error: limitError } = await admin.rpc(
      "consume_edge_rate_limit",
      {
        p_scope: "admin-users",
        p_subject_hash: subjectHash,
        p_limit: 20,
        p_window_seconds: 60,
      },
    );
    if (limitError) throw limitError;
    if (!limit?.allowed) {
      return jsonResponse(
        {
          success: false,
          code: "RATE_LIMITED",
          retryAfter: limit.retry_after,
          requestId: currentRequestId,
        },
        429,
        { ...cors, "Retry-After": String(limit.retry_after) },
      );
    }

    if (body.action === "create") {
      const nome = String(body.nome || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      const login = String(body.login || "").trim();
      const loginLower = login.toLocaleLowerCase("pt-BR");
      const password = String(body.password || "");

      if (
        nome.length < 3 ||
        nome.length > 160 ||
        login.length < 3 ||
        login.length > 80 ||
        !EMAIL_PATTERN.test(email) ||
        email.length > 254 ||
        !validPassword(password)
      ) {
        return jsonResponse(
          { success: false, code: "INVALID_INPUT", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const [{ data: existingLogin }, { data: existingEmail }] = await Promise.all([
        admin.from("users").select("id").eq("login_lower", loginLower).maybeSingle(),
        admin.from("users").select("id").ilike("email", email).maybeSingle(),
      ]);
      if (existingLogin || existingEmail) {
        return jsonResponse(
          {
            success: false,
            code: existingLogin ? "LOGIN_ALREADY_EXISTS" : "EMAIL_ALREADY_EXISTS",
            requestId: currentRequestId,
          },
          409,
          cors,
        );
      }

      const { data: created, error: createError } =
        await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { nome, perfil: "RH", login },
        });
      if (createError || !created.user) {
        return jsonResponse(
          { success: false, code: "AUTH_CREATE_FAILED", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const userId = created.user.id;
      const { error: profileError } = await admin.from("users").upsert(
        {
          id: userId,
          uid: userId,
          nome,
          email,
          login,
          login_lower: loginLower,
          perfil: "RH",
          status: "Ativo",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (profileError) {
        await admin.auth.admin.deleteUser(userId).catch(() => undefined);
        throw profileError;
      }

      await audit(admin, authData.user.id, "admin.user.created", userId, {
        email,
        login,
        perfil: "RH",
      });

      return jsonResponse(
        {
          success: true,
          code: "USER_CREATED",
          requestId: currentRequestId,
          user: { id: userId, nome, email, login, perfil: "RH", status: "Ativo" },
        },
        201,
        cors,
      );
    }

    const userId = String("userId" in body ? body.userId || "" : "").trim();
    if (!UUID_PATTERN.test(userId)) {
      return jsonResponse(
        { success: false, code: "INVALID_USER_ID", requestId: currentRequestId },
        400,
        cors,
      );
    }
    const target = await targetRh(admin, userId);

    if (body.action === "update") {
      const nome = String(body.nome || "").trim();
      const email = String(body.email || "").trim().toLowerCase();
      if (nome.length < 3 || nome.length > 160 || !EMAIL_PATTERN.test(email)) {
        return jsonResponse(
          { success: false, code: "INVALID_INPUT", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const emailChanged = email !== String(target.email || "").toLowerCase();
      if (emailChanged) {
        const { data: conflict } = await admin
          .from("users")
          .select("id")
          .ilike("email", email)
          .neq("id", userId)
          .maybeSingle();
        if (conflict) {
          return jsonResponse(
            { success: false, code: "EMAIL_ALREADY_EXISTS", requestId: currentRequestId },
            409,
            cors,
          );
        }
      }

      const { error: authUpdateError } =
        await admin.auth.admin.updateUserById(userId, {
          ...(emailChanged ? { email, email_confirm: true } : {}),
          user_metadata: { nome, perfil: "RH", login: target.login },
        });
      if (authUpdateError) {
        return jsonResponse(
          { success: false, code: "AUTH_UPDATE_FAILED", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const { error: profileError } = await admin
        .from("users")
        .update({ nome, email, updated_at: new Date().toISOString() })
        .eq("id", userId);
      if (profileError) {
        await admin.auth.admin
          .updateUserById(userId, {
            email: target.email,
            user_metadata: { nome: target.nome, perfil: "RH", login: target.login },
          })
          .catch(() => undefined);
        throw profileError;
      }

      await audit(admin, authData.user.id, "admin.user.updated", userId, {
        fields: emailChanged ? ["nome", "email"] : ["nome"],
      });

      return jsonResponse(
        { success: true, code: "USER_UPDATED", requestId: currentRequestId },
        200,
        cors,
      );
    }

    if (body.action === "reset_password") {
      const password = String(body.password || "");
      if (!validPassword(password)) {
        return jsonResponse(
          { success: false, code: "INVALID_PASSWORD", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const { error } = await admin.auth.admin.updateUserById(userId, { password });
      if (error) {
        return jsonResponse(
          { success: false, code: "AUTH_PASSWORD_RESET_FAILED", requestId: currentRequestId },
          400,
          cors,
        );
      }

      await audit(admin, authData.user.id, "admin.user.password_reset", userId, {});
      return jsonResponse(
        { success: true, code: "PASSWORD_RESET", requestId: currentRequestId },
        200,
        cors,
      );
    }

    if (body.action === "set_status") {
      const requestedStatus = String(body.status || "");
      const status = requestedStatus === "Inativo" ? "cancelado" : requestedStatus;
      if (!new Set(["Ativo", "Congelado", "cancelado"]).has(status)) {
        return jsonResponse(
          { success: false, code: "INVALID_STATUS", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const active = status === "Ativo";
      const { error: authUpdateError } =
        await admin.auth.admin.updateUserById(userId, {
          ban_duration: active ? "none" : "876000h",
        });
      if (authUpdateError) throw authUpdateError;

      const { error: profileError } = await admin
        .from("users")
        .update({
          status,
          removed_at: active ? null : new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);
      if (profileError) {
        await admin.auth.admin
          .updateUserById(userId, {
            ban_duration:
              String(target.status || "").toLocaleLowerCase("pt-BR") === "ativo"
                ? "none"
                : "876000h",
          })
          .catch(() => undefined);
        throw profileError;
      }

      await audit(admin, authData.user.id, "admin.user.status_changed", userId, {
        previousStatus: target.status,
        status,
      });
      return jsonResponse(
        { success: true, code: "STATUS_UPDATED", requestId: currentRequestId },
        200,
        cors,
      );
    }

    return jsonResponse(
      { success: false, code: "INVALID_ACTION", requestId: currentRequestId },
      400,
      cors,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = message === "USER_NOT_FOUND" ? 404 : 500;
    console.error(
      JSON.stringify({
        event: "admin_users_failed",
        requestId: currentRequestId,
        error: message.split(":")[0],
      }),
    );
    return jsonResponse(
      {
        success: false,
        code: status === 404 ? "USER_NOT_FOUND" : "INTERNAL_ERROR",
        requestId: currentRequestId,
      },
      status,
      cors,
    );
  }
});
