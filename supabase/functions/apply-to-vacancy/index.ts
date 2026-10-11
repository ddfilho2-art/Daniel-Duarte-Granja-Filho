import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const WORKER_URL =
  Deno.env.get("CANDIDATE_ANALYSIS_WORKER_URL") ||
  "https://dmzagrakkduddofkqjhg.supabase.co/functions/v1/candidate-analysis-worker";

const DEFAULT_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

function corsHeaders(req: Request) {
  const origin = req.headers.get("Origin");
  const allowed = new Set(
    (Deno.env.get("ALLOWED_ORIGINS") || "")
      .split(",")
      .map((x) => x.trim())
      .filter(Boolean),
  );
  if (!origin) {
    return {
      "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info, x-tenant-id",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }
  if (!allowed.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, apikey, content-type, x-client-info, x-tenant-id",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function response(req: Request, body: unknown, status = 200) {
  const cors = corsHeaders(req);
  if (!cors) {
    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      { status: 403, headers: { ...DEFAULT_HEADERS, Vary: "Origin" } },
    );
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...DEFAULT_HEADERS, ...cors },
  });
}

async function readBody(req: Request) {
  const contentType = req.headers.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("unsupported_media_type");
  }
  const body = await req.json();
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw new Error("invalid_json");
  }
  return body as Record<string, unknown>;
}

Deno.serve(async (req) => {
  const cors = corsHeaders(req);
  if (!cors) return response(req, { success: false, error: "Origin not allowed" }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return response(req, { success: false, error: "POST method required" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    return response(req, { success: false, error: "service_not_configured" }, 503);
  }

  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return response(req, { success: false, error: "authorization_required" }, 401);
  }

  try {
    const body = await readBody(req);
    const vagaId = typeof body.vaga_id === "string" ? body.vaga_id.trim() : "";
    const origem = typeof body.origem === "string" ? body.origem.trim().slice(0, 200) : "";
    const indicacaoNome =
      typeof body.indicacao_nome === "string"
        ? body.indicacao_nome.trim().slice(0, 200)
        : null;

    if (!vagaId || !origem) {
      return response(req, { success: false, error: "vaga_id_and_origem_required" }, 400);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data, error } = await userClient.rpc("rpc_candidatar_se", {
      p_vaga_id: vagaId,
      p_origem: origem,
      p_indicacao_nome: indicacaoNome,
    });

    if (error) {
      const message = error.message || "";
      const code =
        message.includes("already_applied") ? "already_applied" :
        message.includes("resume_incomplete") ? "resume_incomplete" :
        message.includes("vacancy_headcount_reached") ? "vacancy_not_available" :
        message.includes("vacancy_not_available") ? "vacancy_not_available" :
        message.includes("candidate_access_required") ? "candidate_access_required" :
        message.includes("authentication_required") ? "authentication_required" :
        "application_failed";
      const status =
        code === "already_applied" ? 409 :
        code === "resume_incomplete" || code === "vacancy_not_available" ? 422 :
        code === "authentication_required" || code === "candidate_access_required" ? 403 : 500;
      return response(req, { success: false, error: code }, status);
    }

    const application = Array.isArray(data) ? data[0] : data;
    if (!application?.candidatura_id || !application?.candidato_id) {
      return response(req, { success: false, error: "application_not_created" }, 500);
    }

    const workerPromise = fetch(WORKER_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ request_key: application.analysis_request_key }),
    }).catch((error) => {
      console.error("apply-to-vacancy worker trigger failed", error);
    });

    // Keep the application response fast while allowing the worker to start
    // independently of the browser remaining open.
    // @ts-ignore Supabase Edge Runtime provides waitUntil.
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(workerPromise);
    } else {
      await workerPromise;
    }

    return response(req, {
      success: true,
      candidatura_id: application.candidatura_id,
      candidato_id: application.candidato_id,
      vaga_id: application.vaga_id,
      tenant_id: application.tenant_id,
      analysis_status: application.analysis_status,
      analysis_request_key: application.analysis_request_key,
    }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === "unsupported_media_type" || message === "invalid_json") {
      return response(req, { success: false, error: message }, 400);
    }
    console.error("apply-to-vacancy failed", error);
    return response(req, { success: false, error: "application_failed" }, 500);
  }
});
