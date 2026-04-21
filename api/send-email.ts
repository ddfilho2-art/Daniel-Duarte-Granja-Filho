import nodemailer from 'nodemailer';

type EmailPayload = {
  to?: string;
  subject?: string;
  body?: string;
  smtpConfig?: {
    smtpHost?: string;
    smtpPort?: number | string;
    smtpUser?: string;
    smtpPass?: string;
  };
};

function setCors(res: any) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export default async function handler(req: any, res: any) {
  setCors(res);

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      error_type: 'METHOD_NOT_ALLOWED',
      message: 'Método não permitido. Use POST.',
    });
  }

  const payload: EmailPayload =
    typeof req.body === 'object' && req.body !== null ? req.body : {};

  const { to, subject, body } = payload;
  const timestamp = new Date().toISOString();

  const smtpConfig = {
    smtpHost: payload.smtpConfig?.smtpHost || process.env.SMTP_HOST || '',
    smtpPort: payload.smtpConfig?.smtpPort || process.env.SMTP_PORT || '',
    smtpUser: payload.smtpConfig?.smtpUser || process.env.SMTP_USER || '',
    smtpPass: payload.smtpConfig?.smtpPass || process.env.SMTP_PASS || '',
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!to || !emailRegex.test(to)) {
    return res.status(400).json({
      success: false,
      error_type: 'INVALID_DATA',
      message: 'E-mail do destinatário inválido ou ausente.',
    });
  }

  if (!subject || subject.trim().length < 3) {
    return res.status(400).json({
      success: false,
      error_type: 'INVALID_DATA',
      message: 'Assunto do e-mail é muito curto ou ausente.',
    });
  }

  if (!body || body.trim().length < 5) {
    return res.status(400).json({
      success: false,
      error_type: 'INVALID_DATA',
      message: 'Conteúdo do e-mail é muito curto ou ausente.',
    });
  }

  if (
    !smtpConfig.smtpHost ||
    !smtpConfig.smtpPort ||
    !smtpConfig.smtpUser ||
    !smtpConfig.smtpPass
  ) {
    return res.status(400).json({
      success: false,
      error_type: 'INVALID_DATA',
      message: 'Configurações SMTP incompletas.',
    });
  }

  const { smtpHost, smtpPort, smtpUser, smtpPass } = smtpConfig;

  try {
    console.log(
      JSON.stringify({
        type: 'EMAIL_ATTEMPT',
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
      let errorType = 'CONNECTION_ERROR';
      let friendlyMsg = 'Não foi possível conectar ao servidor de e-mail.';

      if (
        verifyError?.code === 'EAUTH' ||
        String(verifyError?.message || '').includes('Invalid login')
      ) {
        errorType = 'AUTH_ERROR';
        friendlyMsg = 'Falha na autenticação. Verifique usuário e senha.';
        if (smtpHost.includes('gmail.com')) {
          friendlyMsg += ' No Gmail, use uma "Senha de Aplicativo".';
        }
      } else if (verifyError?.code === 'ETIMEDOUT') {
        errorType = 'TIMEOUT';
        friendlyMsg = 'A conexão com o servidor SMTP expirou.';
      }

      console.error(
        JSON.stringify({
          type: 'EMAIL_VERIFY_ERROR',
          timestamp: new Date().toISOString(),
          error_type: errorType,
          message: verifyError?.message,
          code: verifyError?.code,
        }),
      );

      return res.status(401).json({
        success: false,
        error_type: errorType,
        message: friendlyMsg,
        error: friendlyMsg,
        details: verifyError?.message,
      });
    }

    let info: any;
    let attempts = 0;
    const maxRetries = 2;

    while (attempts <= maxRetries) {
      try {
        info = await transporter.sendMail({
          from: `"DFL RH" <${smtpUser}>`,
          to,
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>'),
        });
        break;
      } catch (sendErr: any) {
        attempts++;
        if (attempts > maxRetries) throw sendErr;
        await new Promise((resolve) => setTimeout(resolve, 1000 * attempts));
      }
    }

    console.log(
      JSON.stringify({
        type: 'EMAIL_SUCCESS',
        timestamp: new Date().toISOString(),
        messageId: info?.messageId,
        recipient: to,
      }),
    );

    return res.status(200).json({
      success: true,
      messageId: info?.messageId,
      message: 'E-mail enviado com sucesso.',
    });
  } catch (error: any) {
    console.error(
      JSON.stringify({
        type: 'EMAIL_FATAL_ERROR',
        timestamp: new Date().toISOString(),
        error: error?.message,
        code: error?.code,
        stack: error?.stack,
      }),
    );

    return res.status(500).json({
      success: false,
      error_type: 'SEND_ERROR',
      message: 'Erro interno ao processar o envio de e-mail.',
      error: 'Erro interno ao processar o envio de e-mail.',
      details: error?.message,
    });
  }
}
