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
  
  console.log("Testing error 400 patch...");
  const { data: patchData, error: patchErr } = await supabase.from('candidaturas').update({status: 'Reserva'}).eq('id', '12341234-1234-1234-1234-123412341234');
  console.log("Patch error:", patchErr);
  
  process.exit(0);
}

testQuery();
