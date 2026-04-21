import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  console.log("=== BEGIN AUTO TEST ===");

  // Pegar uma vaga qqr
  const { data: vaga } = await supabase.from('vagas').select('id').limit(1).maybeSingle();
  const { data: cand } = await supabase.from('candidatos').select('id').limit(1).maybeSingle();
  
  if (vaga && cand) {
      console.log(`Testando avaliarCandidatoIA com Candidato: ${cand.id} e Vaga: ${vaga.id}`);
      
      const { data, error } = await supabase.rpc('upsert_analise_ia', {
          p_candidato_id: cand.id,
          p_vaga_id: vaga.id,
          p_score_total: 80,
          p_tecnico: 8,
          p_experiencia: 8,
          p_formacao: 8,
          p_soft_skills: 8,
          p_ferramentas: 8,
          p_justificativa: "Teste",
          p_raw_json: {}
      });
      console.log("RPC Error:", error ? error.message : 'Sucesso!');

      const { data: fetchIa, error: fetchErr } = await supabase
          .from('analise_ia_candidato')
          .select('*')
          .eq('candidato_id', cand.id)
          .eq('vaga_id', vaga.id)
          .maybeSingle();

      console.log("Fetched IA maybeSingle Result:", fetchIa ? 'Encontrado' : 'Nulo', fetchErr ? fetchErr.message : 'Sem erro');
  }

  process.exit();
}
run();
