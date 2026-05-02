import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
if(fs.existsSync(envPath)) {
  const envStr = fs.readFileSync(envPath, 'utf8');
  const envVars = envStr.split('\n').reduce((acc, line) => {
    const [key, ...values] = line.split('=');
    if (key && values.length) {
      acc[key] = values.join('=').trim().replace(/"/g, '');
    }
    return acc;
  }, {} as Record<string, string>);

  const supabaseUrl = envVars['VITE_SUPABASE_URL'];
  const serviceRoleKey = envVars['VITE_SUPABASE_SERVICE_ROLE_KEY'] || envVars['VITE_SUPABASE_ANON_KEY'];
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  async function fix() {
    // We only have the generic client here, we might need supabase admin client for setting password.
    // Let's at least set the logins in public.users.
    
    await supabase.from('users').update({
      login: 'andressa.compliance',
      login_lower: 'andressa.compliance'
    }).eq('email', 'andressa.compliance@exemplo.com');

    await supabase.from('users').update({
      login: 'ricardo.processos',
      login_lower: 'ricardo.processos'
    }).eq('email', 'ricardo.processos@exemplo.com');
    
    // Attempt Auth update if service_role used
    if (envVars['VITE_SUPABASE_SERVICE_ROLE_KEY']) {
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
    console.log('Fixed users.');
  }
  fix();
} else {
  console.log('.env not found!');
}
