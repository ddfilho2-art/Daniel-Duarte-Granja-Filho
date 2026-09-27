import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
import { corsHeaders, jsonResponse, readJsonBody } from "shared/http.ts";

interface AnalysisRequest {
  candidato_id: string;
  vaga_id: string;
  force?: boolean;
}

interface AnalysisResponse {
  success: boolean;
  data?: unknown;
  error?: string;
  status?: string;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

if (!supabaseAnonKey) {
  throw new Error("Missing SUPABASE_ANON_KEY");
}

function createUserClient(userToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: userToken } },
  });
}

async function getAnalysisStatus(requestKey: string): Promise<AnalysisResponse> {
  try {
    const userId = authHeader.slice("Bearer ".length).trim();

    const { data: authData, error: authError } = await supabase.auth.getUser(userId);
    if (authError || !authData.user) {
      return respond( {
        success: false,
        error: "Invalid authentication token",
      }, 401);
    }

    const subjectHash = await generateHash(
      `candidate-analysis:${tenantId}:${authData.user.id}`
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
      console.error("candidate-analysis rate limit failed:", rateLimitError.message);
      return respond( {
        success: false,
        error: "Rate limit service unavailable",
      }, 503);
    }

    if (!rateLimit?.allowed) {
      return respond( {
        success: false,
        error: "Too many analysis requests",
      }, 429, {
        "Retry-After": String(rateLimit.retry_after ?? 3600),
      });
    }

    const { data: existingPending } = await supabase
      .from("analise_ia_candidato")
      .select("id,status,created_at")
      .eq("tenant_id", tenantId)
      .eq("candidato_id", body.candidato_id)
      .eq("vaga_id", body.vaga_id)
      .in("status", ["pending", "processing"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingPending) {
      return respond( {
        success: true,
        data: existingPending,
        status: "ALREADY_QUEUED",
      }, 200);
    }

    const { data, error } = await supabase
      .from("analise_ia_candidato")
      .select("*")
      .eq("candidatura_id", requestKey)
      .single();

    if (error) throw error;

    return {
      success: true,
      data,
      status: data?.status,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function generateHash(input: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function validateAccess(
  tenantId: string,
  candidatoId: string,
  vagaId: string,
  userToken: string
): Promise<{ valid: boolean; error?: string; candidaturaId?: string }> {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(
      userToken.replace("Bearer ", "")
    );

    if (userError || !userData.user) {
      return { valid: false, error: "Invalid authentication token" };
    }

    const userClient = createUserClient(userToken);
    const { data: tenantAccess, error: tenantError } = await userClient.rpc(
      "get_current_tenant_access",
      { p_tenant_id: tenantId }
    );

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

    return { valid: true, candidaturaId: candidatura.id };
  } catch (error) {
    return {
      valid: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function handleRequest(req: Request): Promise<Response> {
  const cors = corsHeaders(req);

  if (!cors) {
    return new Response(
      JSON.stringify({ success: false, error: "Origin not allowed" }),
      { status: 403, headers: { "Content-Type": "application/json", Vary: "Origin" } },
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
    return respond( { success: false, error: "POST method required" }, 405);
  }

  try {
    const tenantId = req.headers.get("x-tenant-id");
    if (!tenantId) {
      return respond( {
        success: false,
        error: "x-tenant-id header required",
      }, 400);
    }

    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return respond( {
        success: false,
        error: "authorization header required",
      }, 401);
    }

    const bodyResult = await readJsonBody<AnalysisRequest>(req);
    if (!bodyResult.ok) {
      return respond( {
        success: false,
        error: bodyResult.error,
      }, bodyResult.status);
    }

    const body = bodyResult.data;
    if (!body.candidato_id || !body.vaga_id) {
      return respond( {
        success: false,
        error: "candidato_id and vaga_id required",
      }, 400);
    }

    const access = await validateAccess(
      tenantId,
      body.candidato_id,
      body.vaga_id,
      authHeader
    );

    if (!access.valid) {
      return respond( {
        success: false,
        error: access.error,
      }, 403);
    }

    const { data, error } = await supabase
      .from("analise_ia_candidato")
      .insert({
        candidato_id: body.candidato_id,
        vaga_id: body.vaga_id,
        tenant_id: tenantId,
        candidatura_id: access.candidaturaId,
        status: "pending",
        input_hash: await generateHash(
          JSON.stringify({
            candidato_id: body.candidato_id,
            vaga_id: body.vaga_id,
          })
        ),
      })
      .select()
      .single();

    if (error) {
      return respond( {
        success: false,
        error: error.message,
      }, 409);
    }

    return respond( { success: true, data }, 200);
  } catch (error) {
    console.error("Error:", error);
    return respond( {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }, 500);
  }
}

serve(handleRequest);
