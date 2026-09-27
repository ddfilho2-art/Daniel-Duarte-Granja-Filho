import { getSupabaseTenantId, supabase } from "./supabase";

export async function safeFetch(url: string, options?: RequestInit) {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const headers = new Headers(options?.headers);
  if (session?.access_token) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }

  const tenantId = getSupabaseTenantId();
  if (tenantId) {
    headers.set("x-tenant-id", tenantId);
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  const text = await response.text();
  const normalizedUrl = url.toLowerCase();
  const isEmailEndpoint =
    normalizedUrl.includes("/api/send-email") ||
    normalizedUrl.includes("/api/retry-emails");
  const isHtmlResponse = !text || text.trim().startsWith("<!doctype html");

  if (isHtmlResponse) {
    if (isEmailEndpoint) {
      console.warn(
        "Endpoint de e-mail indisponível ou retornando HTML no ambiente atual:",
        url,
      );
      throw new Error("Endpoint de e-mail indisponível no ambiente atual.");
    }

    console.error(
      "ERRO CRÍTICO: resposta HTML recebida ao invés de JSON",
      text,
    );
    throw new Error(
      "Sessão inválida ou cookies bloqueados. Atualize a página.",
    );
  }

  try {
    const data = JSON.parse(text);
    return { data, ok: response.ok, status: response.status };
  } catch {
    if (isEmailEndpoint) {
      console.warn("Resposta não JSON do endpoint de e-mail:", text);
      throw new Error("Resposta inválida do endpoint de e-mail.");
    }

    console.error("ERRO JSON:", text);
    throw new Error("Resposta inválida do servidor (não é um JSON válido).");
  }
}
