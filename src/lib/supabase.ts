import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("⚠️ Supabase credentials missing. Check your .env file.");
}

export const supabase: SupabaseClient = createClient(
  supabaseUrl || "",
  supabaseAnonKey || "",
);

const isBrowser = typeof window !== "undefined";
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

// IMPORTANTE:
// - No navegador, NÃO criamos client administrativo para evitar múltiplas instâncias
//   e exposição desnecessária de comportamento privilegiado.
// - Em contexto não-browser, ele pode existir caso a chave esteja disponível.
export const supabaseAdmin: SupabaseClient | null =
  !isBrowser && supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

// Debug apenas do client principal no browser
if (isBrowser && import.meta.env.DEV) {
  (window as any).supabase = supabase;
}

/*
 * Padrão recomendado:
 * - Frontend: use apenas `supabase`
 * - Operações administrativas sensíveis: use API server-side
 * - `supabaseAdmin` não deve ser usado no navegador
 */
