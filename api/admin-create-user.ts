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
      .select("id, perfil, nome, email")
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
        message: "Apenas administradores podem criar usuários RH.",
      });
    }

    const payload =
      typeof req.body === "object" && req.body !== null ? req.body : {};
    const nome = String(payload.nome || "").trim();
    const email = String(payload.email || "")
      .trim()
      .toLowerCase();
    const login = String(payload.login || "").trim();
    const loginLower = login.toLowerCase();
    const senha = String(payload.senha || "");

    if (!nome || nome.length < 3) {
      return res.status(400).json({
        success: false,
        code: "INVALID_NAME",
        message: "Nome inválido.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: "E-mail inválido.",
      });
    }

    if (!login || login.length < 3) {
      return res.status(400).json({
        success: false,
        code: "INVALID_LOGIN",
        message: "Login inválido.",
      });
    }

    if (!senha || senha.length < 6) {
      return res.status(400).json({
        success: false,
        code: "INVALID_PASSWORD",
        message: "Senha inválida. Use pelo menos 6 caracteres.",
      });
    }

    const { data: existingLogin, error: existingLoginError } =
      await supabaseAdmin
        .from("users")
        .select("id")
        .eq("login_lower", loginLower)
        .maybeSingle();

    if (existingLoginError) {
      throw existingLoginError;
    }

    if (existingLogin) {
      return res.status(409).json({
        success: false,
        code: "LOGIN_ALREADY_EXISTS",
        message: "Este login já está em uso.",
      });
    }

    const { data: existingEmail, error: existingEmailError } =
      await supabaseAdmin
        .from("users")
        .select("id")
        .eq("email", email)
        .maybeSingle();

    if (existingEmailError) {
      throw existingEmailError;
    }

    if (existingEmail) {
      return res.status(409).json({
        success: false,
        code: "EMAIL_ALREADY_EXISTS",
        message: "Este e-mail já está em uso.",
      });
    }

    const { data: createdAuth, error: createAuthError } =
      await supabaseAdmin.auth.admin.createUser({
        email,
        password: senha,
        email_confirm: true,
        user_metadata: {
          nome,
          perfil: "RH",
          login,
        },
      });

    if (createAuthError || !createdAuth?.user?.id) {
      return res.status(400).json({
        success: false,
        code: "AUTH_CREATE_FAILED",
        message: createAuthError?.message || "Falha ao criar usuário no Auth.",
      });
    }

    const newUserId = createdAuth.user.id;

    const { error: insertUserError } = await supabaseAdmin
      .from("users")
      .insert({
        id: newUserId,
        uid: newUserId,
        nome,
        email,
        login,
        login_lower: loginLower,
        perfil: "RH",
        status: "Ativo",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

    if (insertUserError) {
      await supabaseAdmin.auth.admin.deleteUser(newUserId).catch(() => null);
      throw insertUserError;
    }

    return res.status(200).json({
      success: true,
      code: "USER_CREATED",
      user: {
        id: newUserId,
        nome,
        email,
        login,
        perfil: "RH",
        status: "Ativo",
      },
    });
  } catch (error: any) {
    console.error("[api/admin-create-user] erro:", error);
    return res.status(500).json({
      success: false,
      code: "INTERNAL_ERROR",
      message: error?.message || "Erro interno ao criar usuário RH.",
    });
  }
}
