import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testAuth() {
  const loginLower = 'admin@recrutaai.com.br';
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .or(`login_lower.eq.${loginLower},email.eq.${loginLower}`)
    .limit(1)
    .maybeSingle();
    
  console.log("Admin query data:", data?.email, data?.login_lower, error);

  const loginLowerRH = 'mariarh2026';
  const { data: dataRH, error: errorRH } = await supabase
    .from("users")
    .select("*")
    .or(`login_lower.eq.${loginLowerRH},email.eq.${loginLowerRH}`)
    .limit(1)
    .maybeSingle();
    
  console.log("RH query data:", dataRH?.email, dataRH?.login_lower, errorRH);
  
  // Also query all users with perfil 'RH'
  const {data: rhUsers} = await supabase.from('users').select('email, login, login_lower, perfil').eq('perfil', 'RH');
  console.log("All RH users:", rhUsers);
}
testAuth();
