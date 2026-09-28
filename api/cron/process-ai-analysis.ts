export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    return res.status(405).json({ success: false, code: "METHOD_NOT_ALLOWED" });
  }

  const cronSecret = process.env.CRON_SECRET || "";
  const auth = req.headers.authorization || "";
  if (!cronSecret || auth !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, code: "UNAUTHORIZED" });
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceKey) {
    return res.status(503).json({ success: false, code: "AI_WORKER_NOT_CONFIGURED" });
  }

  try {
    const response = await fetch(`${supabaseUrl}/functions/v1/candidate-analysis-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceKey,
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ source: "vercel-cron-rescue" }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return res.status(502).json({
        success: false,
        code: "AI_WORKER_ERROR",
        workerStatus: response.status,
      });
    }

    return res.status(200).json({
      success: true,
      code: "AI_WORKER_EXECUTED",
      ...data,
    });
  } catch (error: any) {
    console.error("AI worker cron trigger failed", error);
    return res.status(502).json({
      success: false,
      code: "AI_WORKER_TRIGGER_ERROR",
    });
  }
}
