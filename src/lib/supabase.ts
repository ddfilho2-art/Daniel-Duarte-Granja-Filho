import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Check your .env file.');
}

// 🔥 CLIENT PRINCIPAL (USAR SEMPRE NO FRONT)
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

// Mock auth methods for compatibility with other parts of the system
supabase.auth.getUser = async () => {
  const sessionStr = localStorage.getItem('session');
  if (sessionStr) {
    try {
      const session = JSON.parse(sessionStr);
      return { data: { user: session }, error: null } as any;
    } catch (e) {
      return { data: { user: null }, error: new Error('Invalid session') } as any;
    }
  }
  return { data: { user: null }, error: new Error('No session') } as any;
};

supabase.auth.signOut = async () => {
  localStorage.removeItem('session');
  return { error: null };
};

// 🔥 EXPÕE NO WINDOW PRA DEBUG
if (typeof window !== 'undefined') {
  (window as any).supabase = supabase;
  console.log('[DEBUG] Supabase exposto no window ✅');
}

/*
🚨 REMOVIDO COMPLETAMENTE:

- supabaseServiceRoleKey ❌
- supabaseAdmin ❌
- initializeBuckets ❌

👉 Isso deve rodar no BACKEND, nunca no frontend.
*/