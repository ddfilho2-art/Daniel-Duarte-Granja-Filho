import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config();

const url = process.env.VITE_SUPABASE_URL || '';
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(url, anonKey);

async function test() {
  const { data, error } = await supabase.from('candidatos').select('*').limit(5);
  console.log('Candidatos Error:', error);
  
  const { data: userData, error: userError } = await supabase.from('users').select('*').limit(5);
  console.log('Users Error:', userError);
}
test();
