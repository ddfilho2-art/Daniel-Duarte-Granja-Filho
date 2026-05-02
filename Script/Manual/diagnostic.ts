import { supabase } from './src/lib/supabase';

async function investigate() {
  console.log("Fetching users from database...");
  const { data: users, error } = await supabase
    .from('users')
    .select('id, email, login, login_lower, status, perfil')
    .order('perfil');

  if (error) {
    console.error("Error fetching users:", error);
    return;
  }

  console.table(users);
}

investigate();
