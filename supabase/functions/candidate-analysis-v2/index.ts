import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";
const DEFAULT_HEADERS={"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"} as const;
function corsHeaders(req:Request){const origin=req.headers.get("Origin");const allowed=new Set((Deno.env.get("ALLOWED_ORIGINS")||"").split(",").map(x=>x.trim()).filter(Boolean));if(!origin)return {"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, idempotency-key, x-tenant-id","Access-Control-Allow-Methods":"POST, OPTIONS"};if(!allowed.has(origin))return null;return {"Access-Control-Allow-Origin":origin,"Access-Control-Allow-Headers":"authorization, apikey, content-type, x-client-info, idempotency-key, x-tenant-id","Access-Control-Allow-Methods":"POST, OPTIONS","Access-Control-Max-Age":"86400",Vary:"Origin"};}
function jsonResponse(body:unknown,status=200,extraHeaders:Record<string,string>={}){return new Response(JSON.stringify(body),{status,headers:{...DEFAULT_HEADERS,...extraHeaders}})}
async function readJsonBody<T>(req:Request,maxBytes=16384):Promise<T>{const ct=req.headers.get("content-type")||"";if(!ct.toLowerCase().includes("application/json"))throw Error("unsupported_media_type");const len=Number(req.headers.get("content-length")||"0");if(Number.isFinite(len)&&len>maxBytes)throw Error("payload_too_large");const reader=req.body?.getReader();if(!reader)throw Error("invalid_json");const chunks:Uint8Array[]=[];let n=0;while(true){const x=await reader.read();if(x.done)break;n+=x.value.byteLength;if(n>maxBytes){await reader.cancel("payload_too_large");throw Error("payload_too_large")}chunks.push(x.value)}const body=new Uint8Array(n);let o=0;for(const x of chunks){body.set(x,o);o+=x.byteLength}try{return JSON.parse(new TextDecoder().decode(body)) as T}catch{throw Error("invalid_json")}}

interface AnalysisRequest { candidato_id: string; vaga_id: string; force?: boolean; }
interface AnalysisResult {
  score_total: number; score_tecnico: number; score_experiencia: number;
  score_formacao: number; score_soft_skills: number; score_cultura: number;
  resumo_ia: string; risco_evasao: "Baixo" | "Médio" | "Alto"; motivo_risco: string;
  [key: string]: unknown;
}

const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";
const WORKER_URL = Deno.env.get("CANDIDATE_ANALYSIS_WORKER_URL") ||
  "https://dmzagrakkduddofkqjhg.supabase.co/functions/v1/candidate-analysis-worker";
const PROMPT_VERSION = "candidate-match-v1";
const MODEL = "gemini-3.6-flash";

if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
  throw new Error("Missing required Supabase environment variables");
}
const supabase = createClient(supabaseUrl, supabaseServiceKey);

function createUserClient(userToken: string) {
  return createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: userToken } } });
}
async function generateHash(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function cleanText(value: unknown, max = 20000): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function sanitizeResume(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const allowed = [
    "resumo", "habilidades", "experiencias", "formacoes", "idiomas",
    "certificacoes", "competencias", "projetos", "cursos",
  ];
  return Object.fromEntries(allowed.filter((key) => key in source).map((key) => [key, source[key]]));
}
async function validateAccess(
  tenantId: string, candidatoId: string, vagaId: string, userToken: string,
): Promise<{ valid: boolean; userId?: string; error?: string; candidaturaId?: string }> {
  try {
    const token = userToken.replace(/^Bearer\s+/i, "").trim();
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) return { valid: false, error: "Invalid authentication token" };

    const userClient = createUserClient(userToken);
    const { data: tenantAccess, error: tenantError } = await userClient.rpc("get_current_tenant_access", { p_tenant_id: tenantId });
    if (tenantError || !tenantAccess?.hasAccess) return { valid: false, error: "Not authorized for this tenant" };

    const { data: vaga, error: vagaError } = await supabase.from("vagas")
      .select("id, tenant_id").eq("id", vagaId).eq("tenant_id", tenantId).single();
    if (vagaError || !vaga) return { valid: false, error: "Job posting not found in tenant" };

    const { data: candidatura, error: candidaturaError } = await supabase.from("candidaturas")
      .select("id, candidato_id, vaga_id, tenant_id, fase, status")
      .eq("candidato_id", candidatoId).eq("vaga_id", vagaId).eq("tenant_id", tenantId)
      .limit(1).maybeSingle();
    if (candidaturaError || !candidatura) return { valid: false, error: "Candidate application not found in tenant" };

    return { valid: true, userId: userData.user.id, candidaturaId: candidatura.id };
  } catch (error) {
    console.error("candidate-analysis access validation failed", error);
    return { valid: false, error: "Authorization validation failed" };
  }
}

async function buildSnapshot(tenantId: string, candidatoId: string, vagaId: string, candidaturaId: string) {
  const [{ data: candidato, error: candidatoError }, { data: vaga, error: vagaError }, { data: candidatura, error: candidaturaError }] =
    await Promise.all([
      supabase.from("candidatos").select("id,nome,resumo,linkedin,resume_data").eq("id", candidatoId).maybeSingle(),
      supabase.from("vagas").select("id,titulo,descricao,departamento,local,tipo_contrato,requisitos,beneficios,status,exige_prova").eq("id", vagaId).eq("tenant_id", tenantId).maybeSingle(),
      supabase.from("candidaturas").select("id,fase,status,reserva").eq("id", candidaturaId).eq("tenant_id", tenantId).maybeSingle(),
    ]);
  if (candidatoError || vagaError || candidaturaError || !candidato || !vaga || !candidatura) {
    throw new Error("analysis_snapshot_unavailable");
  }
  return {
    tenant_id: tenantId,
    candidate: {
      id: candidato.id,
      nome: cleanText(candidato.nome, 200),
      resumo: cleanText(candidato.resumo),
      linkedin: cleanText(candidato.linkedin, 500),
      resume: sanitizeResume(candidato.resume_data),
    },
    vacancy: {
      id: vaga.id,
      titulo: cleanText(vaga.titulo, 300),
      descricao: cleanText(vaga.descricao),
      departamento: cleanText(vaga.departamento, 300),
      local: cleanText(vaga.local, 300),
      tipo_contrato: cleanText(vaga.tipo_contrato, 100),
      requisitos: cleanText(vaga.requisitos),
      beneficios: cleanText(vaga.beneficios),
      status: cleanText(vaga.status, 100),
      exige_prova: Boolean(vaga.exige_prova),
    },
    application: {
      id: candidatura.id,
      fase: cleanText(candidatura.fase, 100),
      status: cleanText(candidatura.status, 100),
      reserva: Boolean(candidatura.reserva),
    },
  };
}

async function handleRequest(req: Request): Promise<Response> {
  const cors = corsHeaders(req);
  if (!cors) return new Response(JSON.stringify({ success: false, error: "Origin not allowed" }), { status: 403, headers: { "Content-Type": "application/json", Vary: "Origin" } });
  const respond = (body: unknown, status = 200, extraHeaders: Record<string, string> = {}) =>
    jsonResponse(body, status, { ...cors, ...extraHeaders });
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return respond({ success: false, error: "POST method required" }, 405);

  try {
    const tenantId = req.headers.get("x-tenant-id");
    const authHeader = req.headers.get("authorization");
    if (!tenantId) return respond({ success: false, error: "x-tenant-id header required" }, 400);
    if (!authHeader?.startsWith("Bearer ")) return respond({ success: false, error: "authorization header required" }, 401);

    let body: AnalysisRequest;
    try { body = await readJsonBody<AnalysisRequest>(req); }
    catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const status = message === "payload_too_large" ? 413 : message === "unsupported_media_type" ? 415 : 400;
      return respond({ success: false, error: message }, status);
    }
    if (!body.candidato_id || !body.vaga_id) return respond({ success: false, error: "candidato_id and vaga_id required" }, 400);

    const access = await validateAccess(tenantId, body.candidato_id, body.vaga_id, authHeader);
    if (!access.valid || !access.userId || !access.candidaturaId) return respond({ success: false, error: access.error || "Forbidden" }, 403);

    const subjectHash = await generateHash(`candidate-analysis:${tenantId}:${access.userId}`);
    const { data: rateLimit, error: rateLimitError } = await supabase.rpc("consume_edge_rate_limit", {
      p_scope: "candidate_analysis", p_subject_hash: subjectHash, p_limit: 30, p_window_seconds: 3600,
    });
    if (rateLimitError) return respond({ success: false, error: "Rate limit service unavailable" }, 503);
    if (!rateLimit?.allowed) return respond({ success: false, error: "Too many analysis requests" }, 429, { "Retry-After": String(rateLimit?.retry_after ?? 3600) });

    const snapshot = await buildSnapshot(tenantId, body.candidato_id, body.vaga_id, access.candidaturaId);
    const inputHash = await generateHash(JSON.stringify({ prompt_version: PROMPT_VERSION, model: MODEL, snapshot }));

    const requestKey = `candidate-analysis:${tenantId}:${body.candidato_id}:${body.vaga_id}`;
    const { data: claim, error: claimError } = await supabase.rpc("claim_ai_analysis_request", {
      p_request_key: requestKey,
      p_tenant_id: tenantId,
      p_actor_id: access.userId,
      p_candidato_id: body.candidato_id,
      p_vaga_id: body.vaga_id,
      p_prompt_version: PROMPT_VERSION,
      p_model: MODEL,
      p_input_hash: inputHash,
      p_input_snapshot: snapshot,
      p_force: body.force === true,
    });
    if (claimError) {
      console.error("candidate-analysis queue claim failed", claimError.message);
      return respond({ success: false, error: "Analysis request could not be queued" }, 500);
    }

    if (claim?.status === "completed" && claim.result) {
      return respond({ success: true, status: "completed", cached: true, analysis: claim.result as AnalysisResult, requestId: requestKey });
    }

    if (claim?.status === "processing") {
      return respond({ success: true, status: "processing", retryAfter: claim.retry_after ?? 2, requestId: requestKey });
    }

    // Trigger the worker without making the browser wait for Gemini.
    const workerPromise = fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": supabaseServiceKey, "Authorization": `Bearer ${supabaseServiceKey}` },
      body: JSON.stringify({ request_key: requestKey }),
    }).catch((error) => console.error("candidate-analysis worker trigger failed", error));

    // @ts-ignore Supabase Edge Runtime provides waitUntil for background work.
    if (typeof EdgeRuntime !== "undefined" && typeof EdgeRuntime.waitUntil === "function") {
      // @ts-ignore
      EdgeRuntime.waitUntil(workerPromise);
    }

    return respond({ success: true, status: "processing", retryAfter: 2, requestId: requestKey }, 202);
  } catch (error) {
    console.error("candidate-analysis request failed", error);
    return respond({ success: false, error: "Candidate analysis request failed" }, 500);
  }
}

serve(handleRequest);
