import { createClient } from "@supabase/supabase-js";

function setCors(res: any) {
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

function getAdminClient() {
  const supabaseUrl = process.env.SUPABASE_URL || "";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

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
        message: "Apenas administradores podem resetar senha de usuário RH.",
      });
    }

    const payload =
      typeof req.body === "object" && req.body !== null ? req.body : {};
    const userId = String(payload.userId || "").trim();
    const senha = String(payload.senha || "");

    if (!userId) {
      return res.status(400).json({
        success: false,
        code: "INVALID_USER_ID",
        message: "ID do usuário é obrigatório.",
      });
    }

    if (!senha || senha.length < 6) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PASSWORD",
        message: "Senha inválida. Use pelo menos 6 caracteres.",
      });
    }

    const { data: targetUser, error: targetUserError } = await supabaseAdmin
      .from("users")
      .select("id, perfil, email, nome")
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
          "O reset de senha por esta rota é permitido apenas para usuários RH.",
      });
    }

    const { error: authUpdateError } =
      await supabaseAdmin.auth.admin.updateUserById(userId, {
        password: senha,
      });

    if (authUpdateError) {
      return res.status(400).json({
        success: false,
        code: "AUTH_PASSWORD_RESET_FAILED",
        message: authUpdateError.message || "Falha ao resetar senha no Auth.",
      });
    }

    return res.status(200).json({
      success: true,
      code: "PASSWORD_RESET",
      user: {
        id: userId,
        email: targetUser.email,
        nome: targetUser.nome,
      },
    });
  } catch (error: any) {
    console.error("[api/admin-reset-password] erro:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: error?.message || "Erro interno ao resetar senha do usuário RH.",
    });
  }
}
