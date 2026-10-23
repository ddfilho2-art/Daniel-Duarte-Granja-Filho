import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import {
  corsHeaders,
  getClientIp,
  jsonResponse,
  readJsonBody,
  requestId,
  sha256,
} from "shared/http.ts";

type VerificationRequest =
  | { action: "request"; email?: string }
  | { action: "register"; email?: string; name?: string; password?: string; tenantSlug?: string }
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
    let providerCode = "unknown";
    try {
      const payload = await response.clone().json();
      if (typeof payload?.name === "string") providerCode = payload.name.slice(0, 80);
      else if (typeof payload?.code === "string") providerCode = payload.code.slice(0, 80);
    } catch {
      // Keep the diagnostic bounded and never log the provider response body.
    }
    throw new Error(`email_provider_error:${response.status}:${providerCode}`);
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

    if (body.action === "request" || body.action === "register") {
      const isRegistration = body.action === "register";
      const registrationName = String(body.action === "register" ? body.name || "" : "").trim();
      const registrationPassword = String(body.action === "register" ? body.password || "" : "");
      if (isRegistration && (
        registrationName.length < 1 || registrationName.length > 100 ||
        registrationPassword.length < 8 || !/[A-Z]/.test(registrationPassword) ||
        !/[a-z]/.test(registrationPassword) || !/[0-9]/.test(registrationPassword)
      )) {
        return jsonResponse(
          { success: false, code: "INVALID_REGISTRATION_INPUT", requestId: currentRequestId },
          400,
          cors,
        );
      }

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

      let registrationTenantId: string | null = null;
      if (isRegistration) {
        const tenantSlug = String(body.tenantSlug || "").trim().toLowerCase();
        if (!tenantSlug || tenantSlug.length > 120) {
          return jsonResponse(
            { success: false, code: "REGISTRATION_UNAVAILABLE", requestId: currentRequestId },
            403,
            cors,
          );
        }

        const { data: registrationTenant, error: tenantLookupError } = await admin
          .from("tenants")
          .select("id, kind, status, slug")
          .eq("slug", tenantSlug)
          .maybeSingle();
        if (tenantLookupError) throw tenantLookupError;

        if (
          !registrationTenant ||
          registrationTenant.kind !== "employer" ||
          registrationTenant.status !== "active" ||
          registrationTenant.slug !== tenantSlug
        ) {
          return jsonResponse(
            { success: false, code: "REGISTRATION_UNAVAILABLE", requestId: currentRequestId },
            403,
            cors,
          );
        }

        const { data: siteSettings, error: settingsError } = await admin
          .from("tenant_site_settings")
          .select("candidate_signup_enabled")
          .eq("tenant_id", registrationTenant.id)
          .maybeSingle();
        if (settingsError) throw settingsError;
        if (siteSettings?.candidate_signup_enabled === false) {
          return jsonResponse(
            { success: false, code: "REGISTRATION_UNAVAILABLE", requestId: currentRequestId },
            403,
            cors,
          );
        }
        registrationTenantId = registrationTenant.id;
      }

      // Use Auth Admin API: unlike auth.signUp(), createUser does not send
      // Supabase's native confirmation-link email. The account stays unconfirmed
      // until the custom six-digit code is verified.
      let createdUserId: string | null = null;
      if (isRegistration) {
        const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
          email,
          password: registrationPassword,
          email_confirm: false,
          user_metadata: { nome: registrationName, perfil: "Candidato" },
        });
        if (createUserError) {
          const message = createUserError.message.toLowerCase();
          if (message.includes("already registered") || message.includes("already been registered") || message.includes("email_exists") || message.includes("already exists")) {
            return jsonResponse(
              { success: false, code: "EMAIL_ALREADY_REGISTERED", requestId: currentRequestId },
              409,
              cors,
            );
          }
          throw createUserError;
        }
        createdUserId = createdUser?.user?.id ?? null;
        if (!createdUserId || !registrationTenantId) {
          if (createdUserId) await admin.auth.admin.deleteUser(createdUserId);
          throw new Error("candidate_signup_context_missing");
        }

        const { error: intentError } = await admin
          .from("candidate_signup_intents")
          .insert({
            user_id: createdUserId,
            tenant_id: registrationTenantId,
            status: "pending",
          });
        if (intentError) {
          const { error: cleanupError } = await admin.auth.admin.deleteUser(createdUserId);
          if (cleanupError) {
            console.error("candidate_signup_auth_cleanup_failed", {
              requestId: currentRequestId,
              code: cleanupError.code ?? "unknown",
            });
          }
          throw intentError;
        }
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
          if (isRegistration) {
            console.error(
              "candidate_signup_email_delivery_failed",
              JSON.stringify({
                requestId: currentRequestId,
                error: error instanceof Error ? error.message : "unknown_delivery_error",
              }),
            );
            if (createdUserId) {
              const { error: rollbackError } = await admin.auth.admin.deleteUser(createdUserId);
              if (rollbackError) {
                console.error(
                  "candidate_signup_auth_rollback_failed",
                  JSON.stringify({ requestId: currentRequestId, code: rollbackError.code ?? "unknown" }),
                );
              } else {
                console.info("candidate_signup_auth_rollback_completed", currentRequestId);
              }
            }
            return jsonResponse(
              { success: false, code: "EMAIL_DELIVERY_FAILED", requestId: currentRequestId },
              502,
              cors,
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
