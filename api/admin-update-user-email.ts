import { createClient } from "@supabase/supabase-js";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getAdminClient() {
  const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

function getBearerToken(req: any) {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice("Bearer ".length).trim();
}

export default async function handler(req: any, res: any) {
  setCors(res);

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      code: "METHOD_NOT_ALLOWED",
      message: "Método não permitido.",
    });
  }

  const supabaseAdmin = getAdminClient();
  if (!supabaseAdmin) {
    return res.status(500).json({
      success: false,
      code: "SUPABASE_ADMIN_NOT_CONFIGURED",
      message: "Service role não configurada no ambiente.",
    });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Token de autenticação ausente.",
      });
    }

    const {
      data: { user: authUser },
      error: authUserError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authUserError || !authUser) {
      return res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        message: "Sessão inválida ou expirada.",
      });
    }

    const { data: operatorProfile, error: operatorError } = await supabaseAdmin
      .from("users")
      .select("id, perfil")
      .eq("id", authUser.id)
      .maybeSingle();

    if (
      operatorError ||
      !operatorProfile ||
      operatorProfile.perfil !== "Admin"
    ) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        message: "Apenas administradores podem atualizar e-mail de usuário RH.",
      });
    }

    const payload =
      typeof req.body === "object" && req.body !== null ? req.body : {};
    const userId = String(payload.userId || "").trim();
    const newEmail = String(payload.email || "")
      .trim()
      .toLowerCase();

    if (!userId) {
      return res.status(400).json({
        success: false,
        code: "INVALID_USER_ID",
        message: "ID do usuário é obrigatório.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "E-mail inválido.",
      });
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from("users")
      .select("id, email, perfil")
      .eq("id", userId)
      .maybeSingle();

    if (targetUserError) {
      throw targetUserError;
    }

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: "Usuário não encontrado.",
      });
    }

    if (targetUser.perfil !== "RH") {
      return res.status(400).json({
        success: false,
        code: "INVALID_PROFILE",
        message:
          "A atualização por esta rota é permitida apenas para usuários RH.",
      });
    }

    const { data: emailConflict, error: emailConflictError } =
      await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", newEmail)
        .neq("id", userId)
        .maybeSingle();

    if (emailConflictError) {
      throw emailConflictError;
    }

    if (emailConflict) {
      return res.status(409).json({
        success: false,
        code: "EMAIL_ALREADY_EXISTS",
        message: "Este e-mail já está em uso por outro usuário.",
      });
    }

    const previousEmail = targetUser.email;

    const { error: authUpdateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        email: newEmail,
      });

    if (authUpdateError) {
      return res.status(400).json({
        success: false,
        code: "AUTH_UPDATE_FAILED",
        message:
          authUpdateError.message || "Falha ao atualizar e-mail no Auth.",
      });
    }

    const { error: userUpdateError } = await supabaseAdmin
      .from("users")
      .update({
        email: newEmail,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (userUpdateError) {
      await supabaseAdmin.auth.admin
        .updateUserById(userId, {
          email: previousEmail,
        })
        .catch(() => null);
      throw userUpdateError;
    }

    return res.status(200).json({
      success: true,
      code: "EMAIL_UPDATED",
      user: {
        id: userId,
        email: newEmail,
      },
    });
  } catch (error: any) {
    console.error("[api/admin-update-user-email] erro:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message:
        error?.message || "Erro interno ao atualizar e-mail do usuário RH.",
    });
  }
}
