export default async function handler(req: any, res: any) {
  const auth = req.headers.authorization;

  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED'
    });
  }

  const baseUrl = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : 'http://localhost:3000';

  try {
    const response = await fetch(`${baseUrl}/api/retry-emails`, {
      method: 'POST'
    });

    const data = await response.json();

    return res.status(200).json({
      success: true,
      code: 'CRON_EXECUTED',
      ...data
    });

  } catch (error: any) {
    return res.status(500).json({
      success: false,
      code: 'CRON_ERROR',
      error: error.message || String(error)
    });
  }
}
