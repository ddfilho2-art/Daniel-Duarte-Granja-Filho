import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders, jsonResponse, readJsonBody } from "shared/http.ts";

interface AnalysisRequest {
  candidato_id: string;
  vaga_id: string;
  force?: boolean;
}

interface AnalysisResult {
  score_total: number;
  score_tecnico: number;
  score_experiencia: number;
  score_formacao: number;
  score_soft_skills: number;
  score_cultura: number;
  resumo_ia: string;
  risco_evasao: "Baixo" | "Médio" | "Alto";
  motivo_risco: string;
  [key: string]: unknown;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error("Missing required Supabase environment variables");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function createUserClient(userToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: userToken } },
  });
}

async function generateHash(input: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function validateAccess(
  tenantId: string,
  candidatoId: string,
  vagaId: string,
  userToken: string,
): Promise<{ valid: boolean; userId?: string; error?: string; candidaturaId?: string }> {
  try {
    const token = userToken.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } =
      await supabase.auth.getUser(token);

    if (userError || !userData.user) {
      return { valid: false, error: "Invalid authentication token" };
    }

    const userClient = createUserClient(userToken);
    const { data: tenantAccess, error: tenantError } =
      await userClient.rpc("get_current_tenant_access", {
        p_tenant_id: tenantId,
      });

    if (tenantError || !tenantAccess?.hasAccess) {
      return { valid: false, error: "Not authorized for this tenant" };
    }

    const { data: vaga, error: vagaError } = await supabase
      .from("vagas")
      .select("id, tenant_id")
      .eq("id", vagaId)
      .eq("tenant_id", tenantId)
      .single();

    if (vagaError || !vaga) {
      return { valid: false, error: "Job posting not found in tenant" };
    }

    const { data: candidatura, error: candidaturaError } = await supabase
      .from("candidaturas")
      .select("id, candidato_id, vaga_id, tenant_id")
      .eq("candidato_id", candidatoId)
      .eq("vaga_id", vagaId)
      .eq("tenant_id", tenantId)
      .limit(1)
      .maybeSingle();

    if (candidaturaError || !candidatura) {
      return { valid: false, error: "Candidate application not found in tenant" };
    }

    return {
      valid: true,
      userId: userData.user.id,
      candidaturaId: candidatura.id,
    };
  } catch (error) {
    console.error("candidate-analysis access validation failed", error);
    return { valid: false, error: "Authorization validation failed" };
  }
}

async function handleRequest(req: Request): Promise<Response> {
  const cors = corsHeaders(req);

  if (!cors) {
    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      {
        status: 403,
        headers: {
          "Content-Type": "application/json",
          Vary: "Origin",
        },
      },
    );
  }

  const respond = (
    body: unknown,
    status = 200,
    extraHeaders: Record<string, string> = {},
  ) => jsonResponse(body, status, { ...cors, ...extraHeaders });

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }

  if (req.method !== "POST") {
    return respond({ success: false, error: "POST method required" }, 405);
  }

  try {
    const tenantId = req.headers.get("x-tenant-id");
    const authHeader = req.headers.get("authorization");

    if (!tenantId) {
      return respond({ success: false, error: "x-tenant-id header required" }, 400);
    }

    if (!authHeader?.startsWith("Bearer ")) {
      return respond(
        { success: false, error: "authorization header required" },
        401,
      );
    }

    let body: AnalysisRequest;
    try {
      body = await readJsonBody<AnalysisRequest>(req);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status =
        message === "payload_too_large"
          ? 413
          : message === "unsupported_media_type"
            ? 415
            : 400;
      return respond({ success: false, error: message }, status);
    }

    if (!body.candidato_id || !body.vaga_id) {
      return respond(
        { success: false, error: "candidato_id and vaga_id required" },
        400,
      );
    }

    const access = await validateAccess(
      tenantId,
      body.candidato_id,
      body.vaga_id,
      authHeader,
    );

    if (!access.valid || !access.userId) {
      return respond(
        { success: false, error: access.error || "Forbidden" },
        403,
      );
    }

    const subjectHash = await generateHash(
      `candidate-analysis:${tenantId}:${access.userId}`,
    );

    const { data: rateLimit, error: rateLimitError } = await supabase.rpc(
      "consume_edge_rate_limit",
      {
        p_scope: "candidate_analysis",
        p_subject_hash: subjectHash,
        p_limit: 30,
        p_window_seconds: 3600,
      },
    );

    if (rateLimitError) {
      console.error("candidate-analysis rate limit failed", rateLimitError.message);
      return respond(
        { success: false, error: "Rate limit service unavailable" },
        503,
      );
    }

    if (!rateLimit?.allowed) {
      return respond(
        { success: false, error: "Too many analysis requests" },
        429,
        { "Retry-After": String(rateLimit?.retry_after ?? 3600) },
      );
    }

    const inputHash = await generateHash(
      JSON.stringify({
        candidato_id: body.candidato_id,
        vaga_id: body.vaga_id,
      }),
    );

    const { data: existing, error: existingError } = await supabase
      .from("analise_ia_candidato")
      .select("id,status,result,input_hash,created_at,updated_at")
      .eq("tenant_id", tenantId)
      .eq("candidato_id", body.candidato_id)
      .eq("vaga_id", body.vaga_id)
      .eq("input_hash", inputHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingError) {
      console.error("candidate-analysis lookup failed", existingError.message);
      return respond(
        { success: false, error: "Analysis lookup failed" },
        500,
      );
    }

    if (existing?.status === "completed" && existing.result) {
      return respond({
        success: true,
        status: "completed",
        cached: true,
        analysis: existing.result as AnalysisResult,
        requestId: existing.id,
      });
    }

    if (
      existing &&
      ["pending", "processing"].includes(String(existing.status))
    ) {
      return respond({
        success: true,
        status: "processing",
        retryAfter: 2,
        requestId: existing.id,
      });
    }

    const { data, error } = await supabase
      .from("analise_ia_candidato")
      .insert({
        candidato_id: body.candidato_id,
        vaga_id: body.vaga_id,
        tenant_id: tenantId,
        candidatura_id: access.candidaturaId,
        status: "pending",
        input_hash: inputHash,
      })
      .select("id,status,created_at,updated_at")
      .single();

    if (error) {
      if (error.code === "23505") {
        const { data: active } = await supabase
          .from("analise_ia_candidato")
          .select("id,status,result")
          .eq("tenant_id", tenantId)
          .eq("candidato_id", body.candidato_id)
          .eq("vaga_id", body.vaga_id)
          .in("status", ["pending", "processing"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (active?.status === "completed" && active.result) {
          return respond({
            success: true,
            status: "completed",
            cached: true,
            analysis: active.result as AnalysisResult,
            requestId: active.id,
          });
        }

        return respond({
          success: true,
          status: "processing",
          retryAfter: 2,
          requestId: active?.id || null,
        });
      }

      console.error("candidate-analysis enqueue failed", error.message);
      return respond(
        { success: false, error: "Analysis request could not be queued" },
        500,
      );
    }

    return respond({
      success: true,
      status: "processing",
      retryAfter: 2,
      requestId: data.id,
    }, 202);
  } catch (error) {
    console.error("candidate-analysis request failed", error);
    return respond(
      { success: false, error: "Candidate analysis request failed" },
      500,
    );
  }
}

serve(handleRequest);
