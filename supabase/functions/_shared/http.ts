const DEFAULT_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const;

function configuredOrigins(): Set<string> {
  return new Set(
    (Deno.env.get("ALLOWED_ORIGINS") ?? "")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
  );
}

export function corsHeaders(request: Request): Record<string, string> | null {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return {
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info, idempotency-key, x-tenant-id",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }

  const origins = configuredOrigins();
  if (!origins.has(origin)) return null;

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, idempotency-key, x-tenant-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...DEFAULT_HEADERS, ...extraHeaders },
  });
}

export function requestId(_request: Request): string {
  return crypto.randomUUID();
}

export async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return (
    request.headers.get("cf-connecting-ip") ||
    request.headers.get("x-real-ip") ||
    forwarded ||
    "unknown"
  );
}

export async function readJsonBody<T>(
  request: Request,
  maxBytes = 16_384,
): Promise<T> {
  const contentType = request.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("unsupported_media_type");
  }

  const length = Number(request.headers.get("content-length") || "0");
  if (Number.isFinite(length) && length > maxBytes) {
    throw new Error("payload_too_large");
  }

  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_json");

  const chunks: Uint8Array[] = [];
  let received = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel("payload_too_large");
      throw new Error("payload_too_large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new Error("invalid_json");
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("invalid_json");
  }

  return parsed as T;
}
