import { createClient } from "@supabase/supabase-js";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 4000;
const RATE_LIMIT = 60;
const RATE_WINDOW_SECONDS = 3600;

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseServiceRoleKey
    ? createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

const authClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

async function sha256(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function getBearerToken(req: any): string | null {
  const authorization = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authorization !== "string" || !authorization.startsWith("Bearer ")) {
    return null;
  }

  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

function setCors(res: any, req: any): boolean {
  const origin = req.headers?.origin || req.headers?.Origin;
  const appUrl = process.env.APP_URL?.trim().replace(/\/$/, "");

  if (origin && appUrl && origin !== appUrl) {
    return false;
  }

  if (origin && appUrl) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Tenant-Id");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Vary", "Origin");
  return true;
}

async function fetchWithRetry(
  url: string,
  options: any,
  onRetry?: (attempt: number) => Promise<void>,
) {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    if (attempt > 0 && onRetry) {
      await onRetry(attempt).catch((error) =>
        console.error("Error updating retry state:", error),
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }

      if (![429, 500, 502, 503].includes(response.status)) {
        throw new Error(`Non-retryable error: ${response.status}`);
      }
    } catch (error) {
      clearTimeout(timeout);
      if (attempt === MAX_RETRIES - 1) throw error;
    }

    attempt++;
    await new Promise((resolve) => setTimeout(resolve, 300 * attempt));
  }

  throw new Error("Max retries reached");
}

export default async function handler(req: any, res: any) {
  if (!setCors(res, req)) {
    return res.status(403).json({
      success: false,
      code: "ORIGIN_NOT_ALLOWED",
    });
  }

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  const requestId =
    typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : Date.now().toString(36) + Math.random().toString(36).substring(2);
  const start = Date.now();

  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        success: false,
        code: "METHOD_NOT_ALLOWED",
        requestId,
      });
    }

    if (!supabase || !authClient) {
      return res.status(500).json({
        success: false,
        code: "SUPABASE_NOT_CONFIGURED",
        requestId,
      });
    }

    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        requestId,
      });
    }

    const {
      data: { user: authUser },
      error: authError,
    } = await authClient.auth.getUser(token);

    if (authError || !authUser) {
      return res.status(401).json({
        success: false,
        code: "INVALID_SESSION",
        requestId,
      });
    }

    const { data: operator, error: operatorError } = await supabase
      .from("users")
      .select("id, perfil, status")
      .eq("id", authUser.id)
      .maybeSingle();

    if (
      operatorError ||
      !operator ||
      !["admin", "rh"].includes(String(operator.perfil || "").toLowerCase()) ||
      ["inativo", "inactive", "suspended"].includes(
        String(operator.status || "ativo").toLowerCase(),
      )
    ) {
      return res.status(403).json({
        success: false,
        code: "FORBIDDEN",
        requestId,
      });
    }

    const subjectHash = await sha256(`send-email:user:${authUser.id}`);
    const { data: rateLimit, error: rateLimitError } = await supabase.rpc(
      "consume_edge_rate_limit",
      {
        p_scope: "api_send_email",
        p_subject_hash: subjectHash,
        p_limit: RATE_LIMIT,
        p_window_seconds: RATE_WINDOW_SECONDS,
      },
    );

    if (rateLimitError) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "send_email_rate_limit_failed",
          requestId,
          error: rateLimitError.message,
        }),
      );
      return res.status(503).json({
        success: false,
        code: "RATE_LIMIT_UNAVAILABLE",
        requestId,
      });
    }

    if (!rateLimit?.allowed) {
      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        retryAfter: Number(rateLimit?.retry_after || 60),
        requestId,
      });
    }

    const input =
      typeof req.body === "object" && req.body !== null ? req.body : {};
    const to = String(input.to || "").trim().toLowerCase();
    const subject = String(input.subject || "").trim();
    const html = typeof input.html === "string" ? input.html : "";
    const body = typeof input.body === "string" ? input.body : "";

    const emailContent = html || (body ? body.replace(/\n/g, "<br>") : "");

    if (!to || !subject || !emailContent) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        requestId,
      });
    }

    if (to.length > 320 || subject.length > 300 || html.length > 1_000_000 || body.length > 500_000) {
      return res.status(413).json({
        success: false,
        code: "PAYLOAD_TOO_LARGE",
        requestId,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        requestId,
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error(
        JSON.stringify({
          level: "error",
          event: "email_config_missing",
          requestId,
          duration: Date.now() - start,
        }),
      );
      return res.status(500).json({
        success: false,
        code: "CONFIG_ERROR",
        requestId,
      });
    }

    const payload = {
      to,
      subject,
      html: html || null,
      body: body || null,
    };

    let queueItem: any = null;

    const { data: queued, error: insertError } = await supabase
      .from("email_queue")
      .insert({
        payload,
        status: "pending",
        attempts: 0,
      })
      .select("id, attempts")
      .single();

    if (!insertError) {
      queueItem = queued;
    } else {
      console.error(
        JSON.stringify({
          level: "error",
          event: "email_queue_insert_failed",
          requestId,
          error: insertError.message,
        }),
      );
    }

    let finalStatus = "sent";
    let errorMessage: string | null = null;

    try {
      await fetchWithRetry(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
            "Idempotency-Key": `recruta-ai/email-send/${queueItem?.id || requestId}`,
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "onboarding@resend.dev",
            to,
            subject,
            html: emailContent,
            text: body,
          }),
        },
        async (attempt: number) => {
          if (queueItem) {
            await supabase
              .from("email_queue")
              .update({
                attempts: (queueItem.attempts || 0) + attempt,
                updated_at: new Date().toISOString(),
              })
              .eq("id", queueItem.id);
          }
        },
      );
    } catch (error: any) {
      finalStatus = "failed";
      errorMessage = error?.message || String(error);
    }

    if (queueItem) {
      await supabase
        .from("email_queue")
        .update({
          status: finalStatus,
          error: errorMessage,
          attempts: (queueItem.attempts || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", queueItem.id);
    }

    console.log(
      JSON.stringify({
        level: finalStatus === "sent" ? "info" : "error",
        event: finalStatus === "sent" ? "email_sent" : "email_failed",
        requestId: queueItem?.id || requestId,
        duration: Date.now() - start,
      }),
    );

    return res.status(finalStatus === "sent" ? 200 : 202).json({
      success: finalStatus === "sent",
      code: finalStatus === "sent" ? "EMAIL_SENT" : "EMAIL_QUEUED",
      requestId: queueItem?.id || requestId,
    });
  } catch (error: any) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "email_failed",
        requestId,
        duration: Date.now() - start,
        error: error?.message || String(error),
      }),
    );

    return res.status(500).json({
      success: false,
      code: "EMAIL_FAILED",
      requestId,
    });
  }
}
