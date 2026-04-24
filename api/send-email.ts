type EmailPayload = {
  to?: string;
  subject?: string;
  body?: string;
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

  // Usar a variável de ambiente para a chave de API externa
  const resendApiKey = process.env.RESEND_API_KEY;

  if (!resendApiKey) {
    console.error('RESEND_API_KEY ausente ou não configurada no ambiente.');
    return res.status(500).json({
      success: false,
      error_type: 'CONFIG_ERROR',
      message: 'Configurações de envio de e-mail (API Key) incompletas no servidor.',
    });
  }

  try {
    console.log(
      JSON.stringify({
        type: 'EMAIL_ATTEMPT',
        timestamp,
        context: { to, subject, provider: 'Resend' },
      }),
    );

    // Usa a API REST do Resend (compatível com edge/serverless, sem nodemailer ou bloqueio SMTP)
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${resendApiKey}`,
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM || 'DFL RH <onboarding@resend.dev>',
        to,
        subject,
        html: body.replace(/\n/g, '<br>'),
        text: body,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Erro HTTP ${response.status} na API externa`);
    }

    const data = await response.json();

    console.log(
      JSON.stringify({
        type: 'EMAIL_SUCCESS',
        timestamp: new Date().toISOString(),
        messageId: data.id,
        recipient: to,
      }),
    );

    return res.status(200).json({
      success: true,
      messageId: data.id,
      message: 'E-mail enviado com sucesso.',
    });
  } catch (error: any) {
    console.error(
      JSON.stringify({
        type: 'EMAIL_FATAL_ERROR',
        timestamp: new Date().toISOString(),
        error: error?.message,
        stack: error?.stack,
      }),
    );

    return res.status(500).json({
      success: false,
      error_type: 'SEND_ERROR',
      message: 'Erro interno ao processar o envio de e-mail.',
      details: error?.message,
    });
  }
}
