import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase credentials missing. Check your .env file.');
}

// 🔥 CLIENT PRINCIPAL (USAR SEMPRE NO FRONT)
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');

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