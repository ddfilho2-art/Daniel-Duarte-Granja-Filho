import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 8080);
  const isProduction = process.env.NODE_ENV === "production";

  app.use(express.json());

  const supabaseUrl = process.env.SUPABASE_URL || "";
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
  const supabase =
    supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, body, smtpConfig } = req.body;
    const timestamp = new Date().toISOString();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !emailRegex.test(to)) {
      return res.status(400).json({
        success: false,
        error_type: "INVALID_DATA",
        message: "E-mail do destinatário inválido ou ausente.",
      });
    }

    if (!subject || subject.trim().length < 3) {
      return res.status(400).json({
        success: false,
        error_type: "INVALID_DATA",
        message: "Assunto do e-mail é muito curto ou ausente.",
      });
    }

    if (!body || body.trim().length < 5) {
      return res.status(400).json({
        success: false,
        error_type: "INVALID_DATA",
        message: "Conteúdo do e-mail é muito curto ou ausente.",
      });
    }

    if (
      !smtpConfig ||
      !smtpConfig.smtpHost ||
      !smtpConfig.smtpPort ||
      !smtpConfig.smtpUser ||
      !smtpConfig.smtpPass
    ) {
      return res.status(400).json({
        success: false,
        error_type: "INVALID_DATA",
        message: "Configurações SMTP incompletas.",
      });
    }

    const { smtpHost, smtpPort, smtpUser, smtpPass } = smtpConfig;

    try {
      console.log(
        JSON.stringify({
          type: "EMAIL_ATTEMPT",
          timestamp,
          context: { to, subject, host: smtpHost, user: smtpUser },
        }),
      );

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        connectionTimeout: 10000,
        greetingTimeout: 5000,
        socketTimeout: 15000,
      });

      try {
        await transporter.verify();
      } catch (verifyError: any) {
        console.error(
          JSON.stringify({
            type: "EMAIL_VERIFY_ERROR",
            timestamp,
            error: verifyError?.message || String(verifyError),
            code: verifyError?.code,
          }),
        );
        return res.status(500).json({
          success: false,
          error_type: "SMTP_VERIFY_ERROR",
          message: "Falha ao validar conexão SMTP.",
          details: verifyError?.message || String(verifyError),
        });
      }

      let info;
      try {
        info = await transporter.sendMail({
          from: `"DFL RH" <${smtpUser}>`,
          to,
          subject,
          text: body,
          html: body.replace(/\n/g, "<br />"),
        });
      } catch (sendError: any) {
        console.error(
          JSON.stringify({
            type: "EMAIL_SEND_ERROR",
            timestamp,
            error: sendError?.message || String(sendError),
            code: sendError?.code,
            stack: sendError?.stack,
          }),
        );
        return res.status(500).json({
          success: false,
          error_type: "SMTP_SEND_ERROR",
          message: "Falha ao enviar e-mail.",
          details: sendError?.message || String(sendError),
        });
      }

      return res.status(200).json({
        success: true,
        message: "E-mail enviado com sucesso.",
        messageId: info?.messageId || null,
      });
    } catch (error: any) {
      console.error(
        JSON.stringify({
          type: "EMAIL_FATAL_ERROR",
          timestamp,
          error: error?.message || String(error),
          code: error?.code,
          stack: error?.stack,
        }),
      );
      return res.status(500).json({
        success: false,
        error_type: "UNEXPECTED_ERROR",
        message: "Erro inesperado ao enviar e-mail.",
        details: error?.message || String(error),
      });
    }
  });

  app.post("/api/retry-emails", async (req, res) => {
    const requestId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : Date.now().toString(36) + Math.random().toString(36).substring(2);

    if (!supabase) {
      return res.status(500).json({
        success: false,
        code: "SUPABASE_NOT_CONFIGURED",
        requestId,
      });
    }

    try {
      if (!process.env.RESEND_API_KEY) {
        return res.status(500).json({
          success: false,
          code: "RESEND_NOT_CONFIGURED",
          requestId,
        });
      }

      const { data: pendingEmails, error } = await supabase
        .from("email_logs")
        .select("*")
        .eq("status", "pending")
        .lt("retry_count", 3)
        .order("created_at", { ascending: true })
        .limit(20);

      if (error) {
        return res.status(500).json({
          success: false,
          code: "EMAIL_LOG_QUERY_ERROR",
          requestId,
          error: error.message,
        });
      }

      if (!pendingEmails || pendingEmails.length === 0) {
        return res.status(200).json({
          success: true,
          code: "NO_PENDING_EMAILS",
          requestId,
          processed: 0,
          sent: 0,
          failed: 0,
        });
      }

      let sent = 0;
      let failed = 0;

      for (const email of pendingEmails) {
        try {
          const response = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: email.from_email || "onboarding@resend.dev",
              to: Array.isArray(email.to_email)
                ? email.to_email
                : [email.to_email],
              subject: email.subject,
              html: email.html_body,
              text: email.text_body || undefined,
            }),
          });

          if (!response.ok) {
            throw new Error(`Resend error: ${response.status}`);
          }

          await supabase
            .from("email_logs")
            .update({
              status: "sent",
              sent_at: new Date().toISOString(),
              retry_count: (email.retry_count || 0) + 1,
              last_error: null,
            })
            .eq("id", email.id);

          sent++;
        } catch (err: any) {
          await supabase
            .from("email_logs")
            .update({
              status: (email.retry_count || 0) + 1 >= 3 ? "failed" : "pending",
              retry_count: (email.retry_count || 0) + 1,
              last_error: err?.message || String(err),
              updated_at: new Date().toISOString(),
            })
            .eq("id", email.id);

          failed++;
        }
      }

      return res.status(200).json({
        success: true,
        code: "RETRY_COMPLETED",
        requestId,
        processed: pendingEmails.length,
        sent,
        failed,
      });
    } catch (error: any) {
      return res.status(500).json({
        success: false,
        code: "RETRY_FATAL_ERROR",
        requestId,
        error: error?.message || String(error),
      });
    }
  });

  if (isProduction) {
    const distPath = path.resolve(__dirname, "dist");
    const indexPath = path.resolve(distPath, "index.html");

    app.use(express.static(distPath, { index: false }));

    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      if (!fs.existsSync(indexPath)) {
        return res
          .status(500)
          .send("Build de produção não encontrado em /dist.");
      }
      return res.sendFile(indexPath);
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });

    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const templatePath = path.resolve(__dirname, "index.html");
        let template = fs.readFileSync(templatePath, "utf-8");
        template = await vite.transformIndexHtml(url, template);
        const mod = await vite.ssrLoadModule("/src/main.tsx");
        if (!mod) {
          return res.status(500).send("Falha ao carregar módulo principal.");
        }
        return res
          .status(200)
          .set({ "Content-Type": "text/html" })
          .end(template);
      } catch (e: any) {
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(
      `Servidor iniciado na porta ${PORT} (${isProduction ? "production" : "development"})`,
    );
  });
}

startServer().catch((error) => {
  console.error("Erro ao iniciar servidor:", error);
  process.exit(1);
});
