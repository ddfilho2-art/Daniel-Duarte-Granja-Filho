import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const serviceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function fix() {
  await supabase.from('users').update({
    login: 'andressa.compliance',
    login_lower: 'andressa.compliance'
  }).eq('email', 'andressa.compliance@exemplo.com');

  await supabase.from('users').update({
    login: 'ricardo.processos',
    login_lower: 'ricardo.processos'
  }).eq('email', 'ricardo.processos@exemplo.com');
  
  if (import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY) {
      await supabase.auth.admin.updateUserById('5d05173d-b263-4cf6-a391-dfd6055f9591', {
        password: 'RAI@andr2026',
        user_metadata: { login: 'andressa.compliance' }
      });
      await supabase.auth.admin.updateUserById('fcf286b5-386d-417e-aabb-1ee70f245568', {
        password: 'RAI@rica2026',
        user_metadata: { login: 'ricardo.processos' }
      });
      console.log('Fixed auth pass!');
  }
  console.log('Fixed users in db!');
}
fix();
