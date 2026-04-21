import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testQuery() {
  console.log("Testing candidatura_eventos...");
  const { data, error } = await supabase.from('candidatura_eventos').select('*, users(nome)').limit(1);
  console.log("Eventos Error:", error);
  
  console.log("Testing analise_ia_candidato...");
  const { data: analise, error: analiseErr } = await supabase.from('analise_ia_candidato').select('*').limit(1);
  console.log("Analise Error:", analiseErr);
  
  process.exit(0);
}

testQuery();
