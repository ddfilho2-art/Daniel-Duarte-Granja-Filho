import { createClient } from "@supabase/supabase-js";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 4000;
const CLAIM_LEASE_MS = 15 * 60 * 1000;

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const supabaseAnonKey =
  process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || "";

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const authClient =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

async function fetchWithRetry(
  url: string,
  options: any,
  onRetry?: (attempt: number) => Promise<void>,
) {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    if (attempt > 0 && onRetry) {
      await onRetry(attempt).catch((e) =>
        console.error("Error updating retry attempt:", e),
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
    } catch (err) {
      clearTimeout(timeout);
      if (attempt === MAX_RETRIES - 1) throw err;
    }

    attempt++;
    await new Promise((r) => setTimeout(r, 300 * attempt));
  }

  throw new Error("Max retries reached");
}

export default async function handler(req: any, res: any) {
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

    if (!supabase) {
      return res.status(500).json({
        success: false,
        code: "SUPABASE_NOT_CONFIGURED",
        requestId,
      });
    }

    const cronSecret = process.env.CRON_SECRET || "";
    const providedCronSecret =
      typeof req.headers?.["x-cron-secret"] === "string"
        ? req.headers["x-cron-secret"]
        : "";
    const authorization =
      typeof req.headers?.authorization === "string"
        ? req.headers.authorization
        : "";

    let authorized = Boolean(cronSecret && providedCronSecret === cronSecret);

    if (!authorized && authClient && authorization.startsWith("Bearer ")) {
      const token = authorization.slice("Bearer ".length).trim();
      const { data: userData } = await authClient.auth.getUser(token);
      if (userData.user) {
        const { data: privilegedUser } = await supabase
          .from("users")
          .select("id,uid,perfil,status")
          .or(`id.eq.${userData.user.id},uid.eq.${userData.user.id}`)
          .maybeSingle();

        authorized = Boolean(
          privilegedUser &&
            ["admin", "rh"].includes(
              String(privilegedUser.perfil || "").toLowerCase(),
            ) &&
            !["inativo", "inactive", "suspended"].includes(
              String(privilegedUser.status || "ativo").toLowerCase(),
            ),
        );
      }
    }

    if (!authorized) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHORIZED",
        requestId,
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return res.status(500).json({
        success: false,
        code: "CONFIG_ERROR",
        requestId,
      });
    }

    const { data: queuingEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .in("status", ["pending", "failed"])
      .lt("attempts", MAX_RETRIES)
      .order("created_at", { ascending: true })
      .limit(20);

    if (fetchError) {
      throw new Error(`Error fetching queue: ${fetchError.message}`);
    }

    if (!queuingEmails || queuingEmails.length === 0) {
      return res.status(200).json({
        success: true,
        code: "NO_EMAILS_TO_RETRY",
        processed: 0,
        claimed: 0,
        successCount: 0,
        failCount: 0,
        requestId,
      });
    }

    let claimedCount = 0;
    let successCount = 0;
    let failCount = 0;

    for (const item of queuingEmails) {
      const id = item.id;
      const previousAttempts = Number(item.attempts || 0);
      const claimToken = crypto.randomUUID();
      const claimCutoff = new Date(
        Date.now() - CLAIM_LEASE_MS,
      ).toISOString();
      const claimNow = new Date().toISOString();

      // Atomic optimistic claim:
      // only the worker that successfully writes the lease may process the row.
      // A stale lease can be recovered after 15 minutes.
      const { data: claimedRows, error: claimError } = await supabase
        .from("email_queue")
        .update({
          processing_token: claimToken,
          processing_started_at: claimNow,
          attempts: previousAttempts + 1,
          updated_at: claimNow,
        })
        .eq("id", id)
        .in("status", ["pending", "failed"])
        .lt("attempts", MAX_RETRIES)
        .or(
          `processing_token.is.null,processing_started_at.lt.${claimCutoff}`,
        )
        .select("*")
        .limit(1);

      if (claimError) {
        console.error(
          JSON.stringify({
            level: "error",
            event: "retry_email_claim_failed",
            requestId,
            emailId: id,
            error: claimError.message,
          }),
        );
        continue;
      }

      const claimedEmail = claimedRows?.[0];
      if (!claimedEmail) {
        // Another worker already owns this row.
        continue;
      }

      claimedCount++;

      const payload = claimedEmail.payload || {};
      const html =
        payload?.html ||
        (payload?.body ? String(payload.body).replace(/\n/g, "<br>") : "");
      const text = payload?.body || "";
      let lastProviderAttempt = 1;

      try {
        await fetchWithRetry(
          "https://api.resend.com/emails",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
              // Stable per-queue-item key protects against duplicate delivery
              // when a worker crashes after Resend accepts the message.
              "Idempotency-Key": `recruta-ai/email-queue/${id}`,
            },
            body: JSON.stringify({
              from: process.env.EMAIL_FROM || "onboarding@resend.dev",
              to: payload?.to,
              subject: payload?.subject,
              html,
              text,
            }),
          },
          async (attempt: number) => {
            lastProviderAttempt = attempt + 1;
            await supabase
              .from("email_queue")
              .update({
                attempts: Math.min(
                  MAX_RETRIES,
                  previousAttempts + lastProviderAttempt,
                ),
                updated_at: new Date().toISOString(),
              })
              .eq("id", id)
              .eq("processing_token", claimToken);
          },
        );

        const { error: sentError } = await supabase
          .from("email_queue")
          .update({
            status: "sent",
            processing_token: null,
            processing_started_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("processing_token", claimToken);

        if (sentError) {
          throw new Error(`Failed to finalize sent email: ${sentError.message}`);
        }

        successCount++;
      } catch (err: any) {
        const attempts = Math.min(
          MAX_RETRIES,
          Math.max(
            Number(claimedEmail.attempts || previousAttempts + 1),
            previousAttempts + lastProviderAttempt,
          ),
        );
        const nextStatus = attempts >= MAX_RETRIES ? "failed" : "pending";

        const { error: failError } = await supabase
          .from("email_queue")
          .update({
            status: nextStatus,
            error: err?.message || String(err),
            processing_token: null,
            processing_started_at: null,
            attempts,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id)
          .eq("processing_token", claimToken);

        if (failError) {
          console.error(
            JSON.stringify({
              level: "error",
              event: "retry_email_failure_update_failed",
              requestId,
              emailId: id,
              error: failError.message,
            }),
          );
        }

        failCount++;
      }
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "retry_emails_completed",
        requestId,
        selected: queuingEmails.length,
        claimed: claimedCount,
        successCount,
        failCount,
        duration: Date.now() - start,
      }),
    );

    return res.status(200).json({
      success: true,
      code: "EMAILS_REPROCESSED",
      processed: queuingEmails.length,
      claimed: claimedCount,
      successCount,
      failCount,
      skippedConcurrent: queuingEmails.length - claimedCount,
      requestId,
    });
  } catch (error: any) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "retry_emails_failed",
        requestId,
        duration: Date.now() - start,
        error: error?.message || String(error),
      }),
    );

    return res.status(500).json({
      success: false,
      code: "RETRY_PROCESS_FAILED",
      requestId,
    });
  }
}
