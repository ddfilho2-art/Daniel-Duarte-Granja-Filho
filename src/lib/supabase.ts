import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias.",
  );
}

let activeTenantId: string | null = null;

export function setSupabaseTenantId(tenantId: string | null): void {
  activeTenantId = tenantId;
}

export function getSupabaseTenantId(): string | null {
  return activeTenantId;
}

const tenantAwareFetch: typeof fetch = (input, init: RequestInit = {}) => {
  const headers = new Headers(
    input instanceof Request ? input.headers : undefined,
  );
  new Headers(init.headers).forEach((value, key) => headers.set(key, value));
  if (activeTenantId) headers.set("x-tenant-id", activeTenantId);

  return globalThis.fetch(input, {
    ...init,
    headers,
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: tenantAwareFetch },
});
