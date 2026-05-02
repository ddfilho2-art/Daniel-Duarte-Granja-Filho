import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// read .env manually
const envPath = path.resolve(process.cwd(), '.env');
const envStr = fs.readFileSync(envPath, 'utf8');
const envVars = envStr.split('\n').reduce((acc, line) => {
  const [key, ...values] = line.split('=');
  if (key && values.length) {
    acc[key] = values.join('=').trim().replace(/"/g, '');
  }
  return acc;
}, {} as Record<string, string>);

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigate() {
  console.log("Fetching users from database...");
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, login, login_lower, status, perfil, nome')
    .order('perfil');

  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  console.table(users);
}
investigate();
