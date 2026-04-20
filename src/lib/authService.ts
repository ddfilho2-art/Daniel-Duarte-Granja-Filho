import { supabase } from './supabase';

export async function loginWithLogin(loginInput: string, passwordInput?: string) {
  const loginLower = loginInput.toLowerCase().trim();

  const { data, error } = await supabase
    .from('users')
    .select('*')
    .or(`login_lower.eq.${loginLower},email.eq.${loginLower}`)
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.error('[AUTH SERVICE] Supabase Error:', error);
    throw new Error('Usuário não encontrado' + (error ? `: ${error.message}` : ''));
  }

  if (passwordInput) {
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: passwordInput,
    });
    
    if (authError) {
      console.error('[AUTH SERVICE] Auth Error:', authError);
      throw new Error(`Senha incorreta (ou erro de credenciais)`);
    }
  }

  if (data.status !== 'Ativo') {
    throw new Error('Usuário inativo');
  }

  const session = {
    id: data.id,
    uid: data.uid,
    nome: data.nome,
    email: data.email,
    login: data.login,
    perfil: data.perfil,
    status: data.status,
    foto_url: data.foto_url,
    cargo: data.cargo,
    matricula: data.matricula,
    unidade_negocio_id: data.unidade_negocio_id,
    resume_completed: data.resume_completed
  };

  localStorage.setItem('session', JSON.stringify(session));

  return session;
}
