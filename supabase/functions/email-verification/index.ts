import { createClient } from "npm:@supabase/supabase-js@2.101.1";

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

type VerificationRequest =
  | { action: "request"; email?: string; captchaToken?: string }
  | {
      action: "verify";
      email?: string;
      code?: string;
      challengeId?: string;
      challengeToken?: string;
    };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_secret:${name}`);
  return value;
}

function secureCode(): string {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 1_000_000).padStart(6, "0");
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return entities[character];
  });
}

async function verifyCaptcha(token: string | undefined, ip: string): Promise<boolean> {
  const secret = Deno.env.get("TURNSTILE_SECRET_KEY")?.trim();
  const environment = Deno.env.get("ENVIRONMENT")?.trim().toLowerCase();

  if (!secret) {
    if (environment === "local" || environment === "development") return true;
    throw new Error("missing_secret:TURNSTILE_SECRET_KEY");
  }
  if (!token) return false;

  const response = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ secret, response: token, remoteip: ip }),
      signal: AbortSignal.timeout(8_000),
    },
  );

  if (!response.ok) return false;
  const result = (await response.json()) as { success?: boolean };
  return result.success === true;
}

async function sendCode(email: string, name: string, code: string): Promise<void> {
  const apiKey = requiredEnv("RESEND_API_KEY");
  const from = requiredEnv("EMAIL_FROM");
  const safeName = escapeHtml(name || "Candidato");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `email-verification:${await sha256(`${email}:${code}`)}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Código de confirmação — DFL Recrutamento",
      text: `Olá ${name || "Candidato"}. Seu código de confirmação é ${code}. Ele expira em 10 minutos.`,
      html: `<p>Olá ${safeName},</p><p>Seu código de confirmação é:</p><p style="font-size:28px;font-weight:700;letter-spacing:6px">${code}</p><p>O código expira em 10 minutos. Se você não solicitou este código, ignore este e-mail.</p>`,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`email_provider_error:${response.status}`);
  }
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const currentRequestId = requestId(request);

  if (!cors) {
    return jsonResponse(
      { success: false, code: "ORIGIN_NOT_ALLOWED", requestId: currentRequestId },
      403,
    );
  }

  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") {
    return jsonResponse(
      { success: false, code: "METHOD_NOT_ALLOWED", requestId: currentRequestId },
      405,
      cors,
    );
  }

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const pepper = requiredEnv("EMAIL_VERIFICATION_PEPPER");
    const body = await readJsonBody<VerificationRequest>(request);
    const email = String(body.email || "").trim().toLowerCase();
    const ip = getClientIp(request);
    const requesterHash = await sha256(`${pepper}:ip:${ip}`);
    const emailHash = await sha256(`${pepper}:email:${email}`);

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return jsonResponse(
        { success: false, code: "INVALID_INPUT", requestId: currentRequestId },
        400,
        cors,
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const rateLimit = async (scope: string, subject: string, limit: number, window: number) => {
      const { data, error } = await admin.rpc("consume_edge_rate_limit", {
        p_scope: scope,
        p_subject_hash: subject,
        p_limit: limit,
        p_window_seconds: window,
      });
      if (error) throw error;
      return data as { allowed: boolean; retry_after: number };
    };

    if (body.action === "request") {
      const ipLimit = await rateLimit(
        "email-verification:request-ip",
        requesterHash,
        20,
        3600,
      );

      if (!ipLimit.allowed) {
        return jsonResponse(
          {
            success: false,
            code: "RATE_LIMITED",
            retryAfter: ipLimit.retry_after,
            requestId: currentRequestId,
          },
          429,
          { ...cors, "Retry-After": String(ipLimit.retry_after) },
        );
      }

      if (!(await verifyCaptcha(body.captchaToken, ip))) {
        return jsonResponse(
          { success: false, code: "CAPTCHA_FAILED", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const emailLimit = await rateLimit(
        "email-verification:send-email",
        emailHash,
        3,
        600,
      );
      if (!emailLimit.allowed) {
        return jsonResponse(
          {
            success: false,
            code: "RATE_LIMITED",
            retryAfter: emailLimit.retry_after,
            requestId: currentRequestId,
          },
          429,
          { ...cors, "Retry-After": String(emailLimit.retry_after) },
        );
      }

      const code = secureCode();
      const challengeToken = `${crypto.randomUUID()}${crypto.randomUUID()}`;
      const codeHash = await sha256(`${pepper}:${email}:${code}`);
      const challengeTokenHash = await sha256(`${pepper}:challenge:${challengeToken}`);
      const { data, error } = await admin.rpc("issue_email_verification_challenge", {
        p_email: email,
        p_code_hash: codeHash,
        p_challenge_token_hash: challengeTokenHash,
      });
      if (error) throw error;

      const challenge = Array.isArray(data) ? data[0] : data;
      if (!challenge?.challenge_id || !challenge?.expires_at) {
        throw new Error("invalid_challenge_response");
      }

      if (challenge.should_send) {
        try {
          await sendCode(email, challenge.recipient_name || "Candidato", code);
        } catch (error) {
          const { error: invalidateError } = await admin.rpc(
            "invalidate_email_verification_challenge",
            { p_challenge_id: challenge.challenge_id },
          );
          if (invalidateError) {
            console.error(
              "email_verification_invalidation_failed",
              invalidateError.code,
            );
          }
          throw error;
        }
      }

      return jsonResponse(
        {
          success: true,
          code: "VERIFICATION_ACCEPTED",
          challengeId: challenge?.challenge_id,
          challengeToken,
          expiresAt: challenge?.expires_at,
          retryAfter: 30,
          requestId: currentRequestId,
        },
        202,
        cors,
      );
    }

    if (body.action === "verify") {
      const code = String(body.code || "").trim();
      const challengeId = String(body.challengeId || "").trim();
      const challengeToken = String(body.challengeToken || "").trim();
      if (
        !CODE_PATTERN.test(code) ||
        !UUID_PATTERN.test(challengeId) ||
        challengeToken.length < 64 ||
        challengeToken.length > 128
      ) {
        return jsonResponse(
          { success: false, code: "INVALID_INPUT", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const attemptLimit = await rateLimit(
        "email-verification:verify-ip",
        requesterHash,
        30,
        3600,
      );
      if (!attemptLimit.allowed) {
        return jsonResponse(
          {
            success: false,
            code: "RATE_LIMITED",
            retryAfter: attemptLimit.retry_after,
            requestId: currentRequestId,
          },
          429,
          { ...cors, "Retry-After": String(attemptLimit.retry_after) },
        );
      }

      const codeHash = await sha256(`${pepper}:${email}:${code}`);
      const challengeTokenHash = await sha256(
        `${pepper}:challenge:${challengeToken}`,
      );
      const { data, error } = await admin.rpc(
        "consume_email_verification_challenge",
        {
          p_challenge_id: challengeId,
          p_email: email,
          p_code_hash: codeHash,
          p_challenge_token_hash: challengeTokenHash,
        },
      );
      if (error) throw error;

      if (!data?.success) {
        return jsonResponse(
          {
            success: false,
            code: "INVALID_OR_EXPIRED_CODE",
            error: data?.error || "invalid_or_expired_code",
            requestId: currentRequestId,
          },
          400,
          cors,
        );
      }

      if (!data.user_id) throw new Error("verification_user_not_found");

      const { error: authError } = await admin.auth.admin.updateUserById(
        data.user_id,
        { email_confirm: true },
      );
      if (authError) throw authError;

      const { data: finalized, error: finalizeError } = await admin.rpc(
        "finalize_email_verification_challenge",
        { p_challenge_id: challengeId },
      );
      if (finalizeError || !finalized?.success) {
        throw finalizeError || new Error("verification_finalize_failed");
      }

      return jsonResponse(
        { success: true, code: "EMAIL_VERIFIED", requestId: currentRequestId },
        200,
        cors,
      );
    }

    return jsonResponse(
      { success: false, code: "INVALID_ACTION", requestId: currentRequestId },
      400,
      cors,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "email_verification_failed",
        requestId: currentRequestId,
        error: error instanceof Error ? error.message : String(error),
      }),
    );

    const message = error instanceof Error ? error.message : String(error);
    const status =
      message === "invalid_json" || message === "unsupported_media_type"
        ? 400
        : message === "payload_too_large"
          ? 413
          : 500;

    return jsonResponse(
      {
        success: false,
        code: status === 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST",
        requestId: currentRequestId,
      },
      status,
      cors,
    );
  }
});
