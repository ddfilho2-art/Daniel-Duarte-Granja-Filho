export async function safeFetch(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  
  const text = await response.text();
  
  if (!text || text.trim().startsWith('<!doctype html')) {
    console.error("ERRO CRÍTICO: resposta HTML recebida ao invés de JSON", text);
    throw new Error("Sessão inválida ou cookies bloqueados. Atualize a página.");
  }

  try {
    const data = JSON.parse(text);
    return { data, ok: response.ok, status: response.status };
  } catch (e) {
    console.error("ERRO JSON:", text);
    throw new Error("Resposta inválida do servidor (não é um JSON válido).");
  }
}
