import { supabase } from "./supabase";

export async function loginWithLogin(
  loginInput: string,
  passwordInput?: string,
) {
  const loginLower = loginInput.toLowerCase().trim();

  const { data, error } = await supabase
    .from("users")
    .select("*")
    .or(`login_lower.eq.${loginLower},email.eq.${loginLower}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error("[AUTH SERVICE] Supabase Error:", error);
    throw new Error(
      "Usuário não encontrado" + (error ? `: ${error.message}` : ""),
    );
  }

  if (passwordInput) {
    const { data: authData, error: authError } =
      await supabase.auth.signInWithPassword({
        email: data.email,
        password: passwordInput,
      });

    // 🔥 REMOVIDO: Fallback automático de signUp que causava inconsistências
    // Usuários devem ser criados apenas via:
    // 1. Formulário de cadastro (Public.tsx)
    // 2. Admin/Seed (supabaseAdmin)
    if (authError) {
      throw new Error("Email ou senha inválidos.");
    }

    // Validação obrigatória de sessão para garantir o JWT
    const {
      data: { session: supabaseSession },
    } = await supabase.auth.getSession();
    if (!supabaseSession) {
      throw new Error("Sessão Supabase não foi criada após autenticação");
    }

    console.log(
      "✅ [AUTH] Sessão Supabase estabelecida:",
      supabaseSession.user.id,
    );
  } else {
    // Se não houver senha, bloqueamos operações que exigem token se o contexto exigir segurança
    console.warn(
      "[AUTH SERVICE] Login sem senha: auth.uid() permanecerá nulo.",
    );
  }

  if (data.status !== "Ativo") {
    throw new Error("Usuário inativo");
  }

  // Capturamos a sessão atual para garantir o UID correto
  const {
    data: { session: supabaseSession },
  } = await supabase.auth.getSession();

  const session = {
    id: data.id,
    uid: supabaseSession?.user?.id || data.uid, // Prioridade para o UID real do Supabase
    nome: data.nome,
    email: data.email,
    login: data.login,
    perfil: data.perfil,
    status: data.status,
    foto_url: data.foto_url,
    cargo: data.cargo,
    matricula: data.matricula,
    unidade_negocio_id: data.unidade_negocio_id,
    resume_completed: data.resume_completed,
  };

  // Sincronização opcional do UID na tabela caso esteja desatualizado (importante para RLS)
  if (supabaseSession && data.uid !== supabaseSession.user.id) {
    console.log("[AUTH] Sincronizando UID na tabela users...");
    await supabase
      .from("users")
      .update({ uid: supabaseSession.user.id })
      .eq("id", data.id);
  }

  localStorage.setItem("session", JSON.stringify(session));
  return session;
}
