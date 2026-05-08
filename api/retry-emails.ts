import { createClient } from "@supabase/supabase-js";

const MAX_RETRIES = 3;
const TIMEOUT_MS = 4000;

const supabaseUrl = process.env.VITE_SUPABASE_URL || "";
const supabaseKey =
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  "";

const supabase =
  supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

async function fetchWithRetry(
  url: string,
  options: any,
  onRetry?: (attempt: number) => Promise<void>,
) {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    if (attempt > 0 && onRetry) {
      await onRetry(attempt).catch((e) =>
        console.error("Error checking retry log:", e),
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

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return res.status(500).json({
        success: false,
        code: "CONFIG_ERROR",
        requestId,
      });
    }

    // Busca emails com falha ou pendentes
    const { data: queuingEmails, error: fetchError } = await supabase
      .from("email_queue")
      .select("*")
      .in("status", ["pending", "failed"])
      .lt("attempts", 3)
      .limit(20);

    if (fetchError) {
      throw new Error(`Error fetching queue: ${fetchError.message}`);
    }

    if (!queuingEmails || queuingEmails.length === 0) {
      return res.status(200).json({
        success: true,
        code: "NO_EMAILS_TO_RETRY",
        processed: 0,
        requestId,
      });
    }

    let successCount = 0;
    let failCount = 0;

    for (const item of queuingEmails) {
      const { id, payload } = item;
      const html =
        payload?.html ||
        (payload?.body ? payload.body.replace(/\n/g, "<br>") : "");
      const text = payload?.body || "";

      try {
        await fetchWithRetry(
          "https://api.resend.com/emails",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
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
            await supabase
              .from("email_queue")
              .update({
                attempts: (item.attempts || 0) + attempt,
                updated_at: new Date().toISOString(),
              })
              .eq("id", id);
          },
        );

        await supabase
          .from("email_queue")
          .update({
            status: "sent",
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        successCount++;
      } catch (err: any) {
        await supabase
          .from("email_queue")
          .update({
            status: "failed",
            error: err.message || String(err),
            attempts: (item.attempts || 0) + 1,
            updated_at: new Date().toISOString(),
          })
          .eq("id", id);

        failCount++;
      }
    }

    console.log(
      JSON.stringify({
        level: "info",
        event: "retry_emails_completed",
        requestId,
        processed: queuingEmails.length,
        successCount,
        failCount,
        duration: Date.now() - start,
      }),
    );

    return res.status(200).json({
      success: true,
      code: "EMAILS_REPROCESSED",
      processed: queuingEmails.length,
      successCount,
      failCount,
      requestId,
    });
  } catch (error: any) {
    console.error(
      JSON.stringify({
        level: "error",
        event: "retry_emails_failed",
        requestId,
        duration: Date.now() - start,
        error: error.message || String(error),
      }),
    );

    return res.status(500).json({
      success: false,
      code: "RETRY_PROCESS_FAILED",
      requestId,
    });
  }
}
