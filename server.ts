import express from 'express';
import { createServer as createViteServer } from 'vite';
import multer from 'multer';
import { fileTypeFromFile } from 'file-type';
import path from 'path';
import fs from 'fs';
import nodemailer from 'nodemailer';

const ALLOWED_MIME_TYPES = [
  'application/msword', // .doc
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
  'application/pdf', // .pdf
  'image/jpeg', // .jpg, .jpeg
  'image/png', // .png
  'image/gif', // .gif
  'image/webp', // .webp
  'image/bmp' // .bmp
];

const MAX_FILE_SIZE = 6 * 1024 * 1024; // 6 MB

// Ensure uploads directory exists
const uploadsDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Sanitize filename: remove special characters, prevent path traversal
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + '-' + sanitizedName);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: MAX_FILE_SIZE, // 6MB limit in backend
    files: 2 // Max 2 files per request
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Serve uploaded files statically
  app.use('/uploads', express.static(uploadsDir, {
    setHeaders: (res, path) => {
      // Prevent execution of files
      res.setHeader('Content-Security-Policy', "default-src 'none'");
      res.setHeader('X-Content-Type-Options', 'nosniff');
    }
  }));

  // API routes FIRST
  app.post('/api/upload', (req, res) => {
    upload.array('files', 2)(req, res, async (err) => {
      if (err) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Um dos arquivos excede o limite de 6 MB.' });
        }
        if (err.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({ error: 'Você pode anexar no máximo 2 arquivos por mensagem.' });
        }
        return res.status(500).json({ error: 'Não foi possível enviar o arquivo. Tente novamente.' });
      }

      try {
        const files = req.files as Express.Multer.File[];
        
        if (!files || files.length === 0) {
          return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
        }

        const uploadedFiles = [];

        for (const file of files) {
          // Validate MIME type using file-type (reads magic bytes)
          const type = await fileTypeFromFile(file.path);
          
          let isValid = false;
          let mimeType = file.mimetype;

          if (type && ALLOWED_MIME_TYPES.includes(type.mime)) {
            isValid = true;
            mimeType = type.mime;
          } else if (file.originalname.toLowerCase().endsWith('.doc') || file.originalname.toLowerCase().endsWith('.docx') || file.originalname.toLowerCase().endsWith('.pdf')) {
            // file-type might not detect older .doc files reliably, fallback to multer's mimetype if it's in allowed list
            if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
               isValid = true;
            }
          }

          if (!isValid) {
            // Delete invalid file
            fs.unlinkSync(file.path);
            return res.status(400).json({ 
              error: `Tipo de arquivo não permitido. São aceitos apenas: Word (.doc, .docx), PDF (.pdf) e imagens (.jpg, .jpeg, .png, .gif, .webp, .bmp).` 
            });
          }

          uploadedFiles.push({
            nome: file.originalname,
            url: `/uploads/${file.filename}`,
            tipo: mimeType,
            tamanho: file.size
          });
        }

        res.json({ files: uploadedFiles });
      } catch (error: any) {
        console.error('Upload error:', error);
        res.status(500).json({ error: 'Não foi possível enviar o arquivo. Tente novamente.' });
      }
    });
  });

  app.use(express.json());

  app.post('/api/send-email', async (req, res) => {
    const { to, subject, body, smtpConfig } = req.body;
    const timestamp = new Date().toISOString();

    // 1. Validação de Dados
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!to || !emailRegex.test(to)) {
      return res.status(400).json({ 
        success: false,
        error_type: 'INVALID_DATA',
        message: 'E-mail do destinatário inválido ou ausente.' 
      });
    }

    if (!subject || subject.trim().length < 3) {
      return res.status(400).json({ 
        success: false,
        error_type: 'INVALID_DATA',
        message: 'Assunto do e-mail é muito curto ou ausente.' 
      });
    }

    if (!body || body.trim().length < 5) {
      return res.status(400).json({ 
        success: false,
        error_type: 'INVALID_DATA',
        message: 'Conteúdo do e-mail é muito curto ou ausente.' 
      });
    }

    if (!smtpConfig || !smtpConfig.smtpHost || !smtpConfig.smtpPort || !smtpConfig.smtpUser || !smtpConfig.smtpPass) {
      return res.status(400).json({ 
        success: false,
        error_type: 'INVALID_DATA',
        message: 'Configurações SMTP incompletas.' 
      });
    }

    const { smtpHost, smtpPort, smtpUser, smtpPass } = smtpConfig;

    try {
      // Log estruturado de início
      console.log(JSON.stringify({
        type: 'EMAIL_ATTEMPT',
        timestamp,
        context: { to, subject, host: smtpHost, user: smtpUser }
      }));

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(smtpPort),
        secure: Number(smtpPort) === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
        // Segurança: Removido rejectUnauthorized: false para garantir TLS válido
        connectionTimeout: 10000, // 10 segundos de timeout de conexão
        greetingTimeout: 5000,
        socketTimeout: 15000
      });

      // 2. Verificação de Conexão e Autenticação
      try {
        await transporter.verify();
      } catch (verifyError: any) {
        let errorType = 'CONNECTION_ERROR';
        let friendlyMsg = 'Não foi possível conectar ao servidor de e-mail.';

        if (verifyError.code === 'EAUTH' || verifyError.message.includes('Invalid login')) {
          errorType = 'AUTH_ERROR';
          friendlyMsg = 'Falha na autenticação. Verifique usuário e senha.';
          if (smtpHost.includes('gmail.com')) {
            friendlyMsg += ' No Gmail, use uma "Senha de Aplicativo".';
          }
        } else if (verifyError.code === 'ETIMEDOUT') {
          errorType = 'TIMEOUT';
          friendlyMsg = 'A conexão com o servidor SMTP expirou.';
        }

        console.error(JSON.stringify({
          type: 'EMAIL_VERIFY_ERROR',
          timestamp: new Date().toISOString(),
          error_type: errorType,
          message: verifyError.message,
          code: verifyError.code
        }));

        return res.status(401).json({ 
          success: false,
          error_type: errorType,
          message: friendlyMsg,
          error: friendlyMsg, // Compatibilidade
          details: verifyError.message
        });
      }

      // 3. Envio com Retry (Reenvio Automático)
      let info;
      let attempts = 0;
      const maxRetries = 2;

      while (attempts <= maxRetries) {
        try {
          info = await transporter.sendMail({
            from: `"DFL RH" <${smtpUser}>`,
            to,
            subject,
            text: body,
            html: body.replace(/\n/g, '<br>')
          });
          break; // Sucesso, sai do loop
        } catch (sendErr: any) {
          attempts++;
          if (attempts > maxRetries) throw sendErr;
          console.log(`[EMAIL] Falha na tentativa ${attempts}. Tentando novamente em ${attempts}s...`);
          await new Promise(r => setTimeout(r, 1000 * attempts));
        }
      }

      console.log(JSON.stringify({
        type: 'EMAIL_SUCCESS',
        timestamp: new Date().toISOString(),
        messageId: info.messageId,
        recipient: to
      }));

      res.json({ 
        success: true, 
        messageId: info.messageId,
        message: 'E-mail enviado com sucesso.'
      });

    } catch (error: any) {
      console.error(JSON.stringify({
        type: 'EMAIL_FATAL_ERROR',
        timestamp: new Date().toISOString(),
        error: error.message,
        code: error.code,
        stack: error.stack
      }));

      res.status(500).json({ 
        success: false,
        error_type: 'SEND_ERROR',
        message: 'Erro interno ao processar o envio de e-mail.',
        error: 'Erro interno ao processar o envio de e-mail.', // Compatibilidade
        details: error.message
      });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
