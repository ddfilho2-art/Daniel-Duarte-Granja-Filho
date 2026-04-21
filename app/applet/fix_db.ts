import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log('Testando relacionamento em candidatura_eventos com users...');
  
  const { data, error } = await supabase
    .from('candidatura_eventos')
    .select('*, users(nome)')
    .limit(1);

  if (error) {
    console.error('Erro ao buscar eventos:', error.message);
    if (error.message.includes("Could not find a relationship")) {
      console.log('Relacionamento ausente. Aplicando SQL de correção via RPC ou imprimindo script...');
      
      const sqlQuery = `
-- Correção da Foreign Key para candidatura_eventos
ALTER TABLE public.candidatura_eventos DROP CONSTRAINT IF EXISTS fk_candidatura_eventos_users;

ALTER TABLE public.candidatura_eventos
ADD CONSTRAINT fk_candidatura_eventos_users
FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
      `;
      console.log('=== SQL PARA EXECUTAR NO SUPABASE DASHBOARD ===');
      console.log(sqlQuery);
      console.log('==============================================');
      
      // Attempt to execute via RPC if such an RPC exists
      const { error: rpcError } = await supabase.rpc('exec_sql', { query: sqlQuery });
      if (rpcError) {
        console.warn('RPC "exec_sql" falhou ou não existe. O SQL acima deve ser executado manualmente.', rpcError.message);
      } else {
        console.log('SQL executado com sucesso via RPC!');
      }
    }
  } else {
    console.log('Relacionamento parece estar OK:', data);
  }

  // Verificando tipos e valores válidos do enum status na tabela candidaturas
  const { data: statusTypes, error: statusErr } = await supabase
    .from('candidaturas')
    .select('status')
    .limit(10);
    
  console.log("Amostra de Status existentes:", statusTypes?.map((s: any) => s.status).filter((v: any, i: any, a: any) => a.indexOf(v) === i));

  // Verificando analise_ia_candidato table info
  const { data: analise, error: analiseErr } = await supabase
    .from('analise_ia_candidato')
    .select('*')
    .limit(1);
  if (analiseErr) {
    console.log('Erro analise:', analiseErr.message);
  } else {
    console.log('Analise schema loaded.');
  }

  process.exit();
}
run();
