import { createClient } from '@supabase/supabase-js';

const MAX_RETRIES = 3;
const TIMEOUT_MS = 4000;

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// We only initialize the client if we have the credentials, otherwise some operations might fail normally.
const supabase = (supabaseUrl && supabaseKey) ? createClient(supabaseUrl, supabaseKey) : null;

async function fetchWithRetry(url: string, options: any, onRetry?: (attempt: number) => Promise<void>) {
  let attempt = 0;

  while (attempt < MAX_RETRIES) {
    if (attempt > 0 && onRetry) {
      await onRetry(attempt).catch(e => console.error("Error checking retry log:", e));
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeout);

      if (response.ok) {
        return response;
      }

      // Retry apenas em erros transitórios
      if (![429, 500, 502, 503].includes(response.status)) {
        throw new Error(`Non-retryable error: ${response.status}`);
      }

    } catch (err) {
      clearTimeout(timeout);
      if (attempt === MAX_RETRIES - 1) throw err;
    }

    attempt++;
    await new Promise(r => setTimeout(r, 300 * attempt)); // backoff simples
  }
  
  throw new Error("Max retries reached");
}

export default async function handler(req: any, res: any) {
  res.setHeader('Vary', 'Origin');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Date.now().toString(36) + Math.random().toString(36).substring(2);
    
  const start = Date.now();
  let logId: string | null = null;

  try {
    if (req.method !== 'POST') {
      return res.status(405).json({
        success: false,
        code: "METHOD_NOT_ALLOWED",
        requestId
      });
    }

    const input = typeof req.body === 'object' && req.body !== null ? req.body : {};
    const { to, subject, html, body } = input;
    // Persist only the fields needed for delivery. Never queue arbitrary request
    // properties because legacy clients may still send SMTP credentials.
    const payload = { to, subject, html: html || null, body: body || null };

    const emailContent = html || (body ? body.replace(/\n/g, '<br>') : null);
    const textContent = body || '';

    if (!to || !subject || !emailContent) {
      return res.status(400).json({
        success: false,
        code: "INVALID_INPUT",
        requestId
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        requestId
      });
    }

    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      console.error(JSON.stringify({
        level: "error",
        event: "email_config_missing",
        requestId,
        duration: Date.now() - start
      }));
      return res.status(500).json({
        success: false,
        code: "CONFIG_ERROR",
        requestId
      });
    }

    let queueItem: any = null;
    
    if (supabase) {
      try {
        const { data, error: insertError } = await supabase
          .from('email_queue')
          .insert({
            payload,
            status: 'pending',
            attempts: 0
          })
          .select()
          .single();
          
        if (insertError) {
           console.error("Supabase insert error for email_queue:", insertError);
        } else {
           queueItem = data;
        }
      } catch (e) {
        console.error("Failed to insert email queue", e);
      }
    }

    let finalStatus = 'sent';
    let errorMessage: string | null = null;

    try {
      const response = await fetchWithRetry(
        "https://api.resend.com/emails",
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            from: process.env.EMAIL_FROM || "onboarding@resend.dev",
            to,
            subject,
            html: emailContent,
            text: textContent
          })
        },
        async (attempt: number) => {
           if (supabase && queueItem) {
              await supabase
                .from('email_queue')
                .update({
                  attempts: (queueItem.attempts || 0) + attempt,
                  updated_at: new Date().toISOString()
                })
                .eq('id', queueItem.id);
           }
        }
      );
    } catch (error: any) {
      finalStatus = 'failed';
      errorMessage = error.message || String(error);
    }

    if (supabase && queueItem) {
       await supabase.from('email_queue').update({
          status: finalStatus,
          error: errorMessage,
          attempts: (queueItem.attempts || 0) + 1,
          updated_at: new Date().toISOString()
       }).eq('id', queueItem.id);
    }

    console.log(JSON.stringify({
      level: finalStatus === 'sent' ? "info" : "error",
      event: finalStatus === 'sent' ? "email_sent" : "email_failed",
      requestId: queueItem?.id || requestId,
      error: errorMessage,
      duration: Date.now() - start
    }));

    return res.status(200).json({
      success: true,
      code: finalStatus === 'sent' ? 'EMAIL_SENT' : 'EMAIL_QUEUED',
      requestId: queueItem?.id || requestId
    });

  } catch (error: any) {
    console.error(JSON.stringify({
      level: "error",
      event: "email_failed",
      requestId,
      duration: Date.now() - start,
      error: error.message || String(error)
    }));

    return res.status(500).json({
      success: false,
      code: "EMAIL_FAILED",
      requestId
    });
  }
}
