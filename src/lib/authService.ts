import { supabase } from "./supabase";

export interface UserProfile {
  id: string;
  uid: string;
  nome: string;
  email: string;
  login: string;
  perfil: string;
  status: string;
  avatar_url?: string;
  foto_url?: string;
  cargo?: string;
  matricula?: string;
  unidade_negocio_id?: string;
  resume_completed?: boolean;
  email_verified?: boolean;
  resume_data?: Record<string, unknown>;
}

function normalizeProfile(
  data: Record<string, any>,
  authUserId: string,
): UserProfile {
  return {
    id: String(data.id),
    uid: authUserId,
    nome: String(data.nome || ""),
    email: String(data.email || ""),
    login: String(data.login || data.email || ""),
    perfil: String(data.perfil || "Candidato"),
    status: String(data.status || ""),
    avatar_url: data.avatar_url,
    foto_url: data.foto_url,
    cargo: data.cargo,
    matricula: data.matricula,
    unidade_negocio_id: data.unidade_negocio_id,
    resume_completed: data.resume_completed,
    email_verified: data.email_verified,
    resume_data: data.resume_data,
  };
}

function assertProfileAccess(profile: UserProfile): void {
  if (profile.status.toLocaleLowerCase("pt-BR") !== "ativo") {
    throw new Error("Usuário inativo");
  }

  if (profile.email_verified === false) {
    throw new Error(
      `EMAIL_NOT_VERIFIED:${profile.email}:${profile.nome || ""}`,
    );
  }
}

export async function loadProfileForAuthUser(
  authUserId: string,
): Promise<UserProfile> {
  const byUid = await supabase
    .from("users")
    .select("*")
    .eq("uid", authUserId)
    .maybeSingle();

  if (byUid.error) throw byUid.error;

  let data = byUid.data;
  if (!data) {
    const byId = await supabase
      .from("users")
      .select("*")
      .eq("id", authUserId)
      .maybeSingle();
    if (byId.error) throw byId.error;
    data = byId.data;
  }

  if (!data) throw new Error("Perfil não encontrado para o usuário autenticado.");

  const profile = normalizeProfile(data, authUserId);
  assertProfileAccess(profile);
  return profile;
}

async function resolveLoginEmail(loginInput: string): Promise<string> {
  const normalized = loginInput.trim().toLocaleLowerCase("pt-BR");
  if (!normalized || !normalized.includes("@")) {
    throw new Error("Informe o e-mail da conta.");
  }
  return normalized;
}

export async function loginWithLogin(
  loginInput: string,
  passwordInput?: string,
): Promise<UserProfile> {
  if (!passwordInput) throw new Error("A senha é obrigatória.");

  const email = await resolveLoginEmail(loginInput);
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email,
      password: passwordInput,
    });

  console.info("[AUTH DEBUG]", {
    event: "SIGN_IN_RESULT",
    userId: authData.user?.id || null,
    session: Boolean(authData.session),
  });

  if (authError || !authData.user || !authData.session) {
    throw new Error("Email ou senha inválidos.");
  }

  try {
    return await loadProfileForAuthUser(authData.user.id);
  } catch (error) {
    console.warn("[AUTH DEBUG]", {
      event: "SIGN_OUT_REQUESTED",
      source: "authService.loginWithLogin.profile-load-failure",
      userId: authData.user.id,
      session: Boolean(authData.session),
    });
    await supabase.auth.signOut();
    throw error;
  }
}

export async function loadCurrentProfile(): Promise<UserProfile | null> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) return null;
  return loadProfileForAuthUser(user.id);
}
