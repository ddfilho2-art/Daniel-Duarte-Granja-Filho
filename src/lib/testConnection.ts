import { supabase } from './supabase';

/**
 * Função isolada para testar a conectividade com o Supabase.
 * Não depende de AuthContext ou sessão ativa.
 * 
 * @param timeoutMs Tempo máximo de espera em milissegundos (padrão: 15000ms)
 */
export async function testSupabaseConnection(timeoutMs: number = 15000) {
  console.log('🧪 [TESTE SUPABASE] Iniciando teste de conexão isolado...');
  
  const startTime = performance.now();
  
  try {
    // Cria uma promessa de timeout para forçar a rejeição se a rede estiver pendurada (hanging)
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('TIMEOUT_EXCEEDED')), timeoutMs)
    );

    // A requisição real para o banco de dados
    const fetchPromise = supabase.from('users').select('*').limit(1);

    console.log(`⏱️ [TESTE SUPABASE] Disparando requisição (Timeout configurado: ${timeoutMs}ms)...`);

    // Executa a corrida entre a requisição e o timeout
    const response = await Promise.race([fetchPromise, timeoutPromise]) as any;

    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    // Trata erros retornados pela própria API do Supabase (ex: RLS, tabela inexistente)
    if (response.error) {
      console.error(`❌ [TESTE SUPABASE] Erro de Resposta da API após ${duration}ms:`, response.error);
      return { success: false, duration, error: response.error };
    }

    // Sucesso total
    console.log(`✅ [TESTE SUPABASE] Sucesso! Resposta recebida em ${duration}ms.`);
    console.log('📦 [TESTE SUPABASE] Dados recebidos:', response.data);
    
    return { success: true, duration, data: response.data };

  } catch (error: any) {
    const endTime = performance.now();
    const duration = (endTime - startTime).toFixed(2);

    // Tratamento detalhado dos tipos de erro
    if (error.message === 'TIMEOUT_EXCEEDED') {
      console.error(`⏳ [TESTE SUPABASE] TIMEOUT: A requisição demorou mais de ${timeoutMs}ms e foi abortada pelo teste.`);
    } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
      console.error(`🔌 [TESTE SUPABASE] ERRO DE REDE: Falha física ao conectar com o servidor após ${duration}ms. Possível bloqueio de CORS, DNS ou queda de internet.`, error);
    } else {
      console.error(`💥 [TESTE SUPABASE] ERRO INESPERADO após ${duration}ms:`, error);
    }

    return { success: false, duration, error };
  }
}
