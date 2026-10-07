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

  const requestUrl = input instanceof Request ? input.url : String(input);
  const authorization = headers.get("authorization");
  const apikey = headers.get("apikey");
  const authorizationEqualsApiKey =
    Boolean(authorization && apikey) &&
    authorization === `Bearer ${apikey}`;
  const transportDebug = {
    url: requestUrl,
    method: init.method || (input instanceof Request ? input.method : "GET"),
    authorizationPresent: Boolean(authorization),
    authorizationEqualsApiKey,
    authorizationRoleHint: authorizationEqualsApiKey
      ? "anon-key"
      : authorization
        ? "present-not-anon-key"
        : "absent",
    apikeyPresent: Boolean(apikey),
    tenantPresent: headers.has("x-tenant-id"),
  };

  if (requestUrl.includes("/rest/v1/rpc/")) {
    console.info("[RPC TRANSPORT DEBUG]", transportDebug);
  }

  if (requestUrl.includes("/rest/v1/logs")) {
    console.info("[LOG TRANSPORT DEBUG]", transportDebug);
  }

  return globalThis.fetch(input, {
    ...init,
    headers,
  });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: { fetch: tenantAwareFetch },
});
