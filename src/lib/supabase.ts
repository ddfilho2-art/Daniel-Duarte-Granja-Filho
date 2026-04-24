import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase credentials missing. Check your .env file.");
}

// 🔥 CLIENT PRINCIPAL (USAR SEMPRE NO FRONT)
export const supabase: SupabaseClient = createClient(
  supabaseUrl || "",
  supabaseAnonKey || "",
);

// 🔥 CLIENT ADMIN (para bypass RLS - usar com cuidado, apenas em operações necessárias)
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// ⚠️ Só cria o admin client se a service role key estiver disponível
export const supabaseAdmin: SupabaseClient | null = supabaseServiceRoleKey
  ? createClient(supabaseUrl || "", supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  : null;

// 🔥 EXPÕE NO WINDOW PRA DEBUG (apenas em desenvolvimento)
if (typeof window !== "undefined" && import.meta.env.DEV) {
  (window as any).supabase = supabase;
  (window as any).supabaseAdmin = supabaseAdmin;
  console.log("[DEBUG] Supabase clients expostos no window ✅");
}

/*
 * 🎯 PADRÃO RECOMENDADO:
 * - Use `supabase` para todas as operações normais do frontend
 * - Use `supabaseAdmin` apenas quando necessário (ex: seed, operações administrativas)
 * - Sempre verifique se supabaseAdmin está disponível antes de usar (!== null)
 * - Isso evita o erro "Multiple GoTrueClient instances detected"
 */
