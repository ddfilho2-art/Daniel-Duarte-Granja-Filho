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
    let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: data.email,
      password: passwordInput,
    });
    
    // Fallback controlado: se falhar o login, tenta descobrir se é porque o usuário não existe no Auth
    if (authError) {
      if (authError.message.includes('Invalid login credentials')) {
        console.warn('[AUTH SERVICE] Credenciais inválidas, checando se é primeira vez (fallback)...');
        const { error: signUpError } = await supabase.auth.signUp({
          email: data.email,
          password: passwordInput,
        });

        if (signUpError && signUpError.message.includes('already registered')) {
          // Já existe, então a senha informada no signInWithPassword realmente estava errada
          throw new Error('Email ou senha inválidos.');
        } else if (!signUpError) {
          // Cadastro automático de fallback funcionou. Vamos logar.
          const { data: retryData, error: retryError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: passwordInput,
          });
          
          if (!retryError) {
            authData = retryData;
            authError = null;
          } else {
            throw new Error(`Falha no login Supabase após auto-cadastro: ${retryError.message}`);
          }
        } else {
          // Outro erro de validação (ex: senha muito curta)
          throw new Error(`Falha na autenticação (validação): ${signUpError.message}`);
        }
      } else {
        // Outros erros de login (ex: rate limit) não caem no fallback
        throw new Error(`Falha na autenticação: ${authError.message}`);
      }
    }

    // Validação obrigatória de sessão para garantir o JWT
    const { data: { session: supabaseSession } } = await supabase.auth.getSession();
    if (!supabaseSession) {
      throw new Error('Sessão Supabase não foi criada após autenticação');
    }

    console.log('✅ [AUTH] Sessão Supabase estabelecida:', supabaseSession.user.id);
  } else {
    // Se não houver senha, bloqueamos operações que exigem token se o contexto exigir segurança
    console.warn('[AUTH SERVICE] Login sem senha: auth.uid() permanecerá nulo.');
  }

  if (data.status !== 'Ativo') {
    throw new Error('Usuário inativo');
  }

  // Capturamos a sessão atual para garantir o UID correto
  const { data: { session: supabaseSession } } = await supabase.auth.getSession();

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
    resume_completed: data.resume_completed
  };

  // Sincronização opcional do UID na tabela caso esteja desatualizado (importante para RLS)
  if (supabaseSession && data.uid !== supabaseSession.user.id) {
    console.log('[AUTH] Sincronizando UID na tabela users...');
    await supabase.from('users').update({ uid: supabaseSession.user.id }).eq('id', data.id);
  }

  localStorage.setItem('session', JSON.stringify(session));

  return session;
}
