import "dotenv/config";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const email = `e2e-stage-isolation-${runId}@example.invalid`;
const password = `E2eStage!${crypto.randomBytes(12).toString("hex")}A1`;
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const vacancyB = crypto.randomUUID();
const candidateB = crypto.randomUUID();
const applicationB = crypto.randomUUID();
const requestKey = `candidate-analysis:${tenantB}:${applicationB}:prova`;

function makeValidCnpj(base12) {
  const digits = String(base12).replace(/\D/g, "").slice(0, 12).padStart(12, "0");
  const digit = (value, weights) => {
    const sum = value.split("").reduce(
      (acc, char, index) => acc + Number(char) * weights[index],
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const d1 = digit(digits, [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = digit(digits + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return digits + d1 + d2;
}

async function must(label, operation) {
  const { data, error } = await operation;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

console.log("=== Recruta AÍ — E2E isolamento da análise por estágio ===");
console.log("Run:", runId);

let authUserId = null;

try {
  await must("tenants", admin.from("tenants").insert([
    {
      id: tenantA,
      kind: "employer",
      cnpj: makeValidCnpj(`21${String(Date.now()).slice(-10)}`),
      legal_name: `Recruta AÍ Stage A ${runId}`,
      display_name: `Recruta AÍ Stage A ${runId}`,
      slug: `e2e-stage-a-${runId}`,
      status: "active",
      metadata: { e2e: true, run_id: runId },
    },
    {
      id: tenantB,
      kind: "employer",
      cnpj: makeValidCnpj(`22${String(Date.now()).slice(-10)}`),
      legal_name: `Recruta AÍ Stage B ${runId}`,
      display_name: `Recruta AÍ Stage B ${runId}`,
      slug: `e2e-stage-b-${runId}`,
      status: "active",
      metadata: { e2e: true, run_id: runId },
    },
  ]));

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: `Candidato Stage E2E ${runId}` },
  });
  if (created.error || !created.data.user) {
    throw new Error("auth_candidate: " + (created.error?.message || "sem usuário"));
  }
  authUserId = created.data.user.id;

  const userReady = await must("candidate user profile", admin.from("users")
    .select("id,perfil,status")
    .or(`id.eq.${authUserId},uid.eq.${authUserId}`)
    .limit(1)
    .single());
  if (userReady.perfil !== "Candidato" || userReady.status !== "Ativo") {
    throw new Error(`perfil Auth/profile inesperado: ${JSON.stringify(userReady)}`);
  }

  await must("membership B", admin.from("tenant_memberships").insert({
    tenant_id: tenantB,
    user_id: authUserId,
    roles: ["candidate"],
    status: "active",
  }));

  await must("candidate B", admin.from("candidatos").insert({
    id: candidateB,
    tenant_id: tenantB,
    user_id: authUserId,
    nome: `Candidato Stage E2E ${runId}`,
    email,
    resumo: "Teste de isolamento tenant da análise por estágio.",
    resume_data: {
      experiencias: [{ cargo: "Analista", empresa: "E2E", periodo: "2024-2026" }],
      formacoes: [{ curso: "Administração" }],
    },
  }));

  await must("vacancy B", admin.from("vagas").insert({
    id: vacancyB,
    titulo: `Vaga Stage B ${runId}`,
    descricao: "Vaga utilizada somente para teste de isolamento de análise.",
    requisitos: "Experiência profissional.",
    status: "Aberta",
    tenant_id: tenantB,
  }));

  await must("application B", admin.from("candidaturas").insert({
    id: applicationB,
    vaga_id: vacancyB,
    candidato_id: candidateB,
    tenant_id: tenantB,
    fase: "Triagem",
    status: "NOVO",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const client = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-tenant-id": tenantA } },
  });

  const signed = await client.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    throw new Error("candidate_signin: " + (signed.error?.message || "sem sessão"));
  }

  const crossTenant = await client.rpc("rpc_solicitar_analise_estagio", {
    p_candidatura_id: applicationB,
    p_analysis_stage: "prova",
    p_input_snapshot: { nota: 90 },
    p_force: false,
  });

  const queuedAfterAttack = await must("cross-tenant queue verification", admin
    .from("ai_analysis_requests")
    .select("request_key,status")
    .eq("request_key", requestKey)
    .maybeSingle());

  const denied =
    Boolean(crossTenant.error) &&
    /tenant_context_mismatch/.test(crossTenant.error.message || "") &&
    !queuedAfterAttack;

  if (!denied) {
    throw new Error(
      `cross-tenant stage request não foi bloqueada: rpc=${JSON.stringify(crossTenant.error)}, queue=${JSON.stringify(queuedAfterAttack)}`,
    );
  }

  const sameTenantClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: {
      headers: {
        "x-tenant-id": tenantB,
        Authorization: `Bearer ${signed.data.session.access_token}`,
      },
    },
  });

  const sameTenant = await sameTenantClient.rpc("rpc_solicitar_analise_estagio", {
    p_candidatura_id: applicationB,
    p_analysis_stage: "prova",
    p_input_snapshot: { nota: 90 },
    p_force: false,
  });

  const sameTenantRequest = await must("same-tenant queue verification", admin
    .from("ai_analysis_requests")
    .select("request_key,status,tenant_id,candidatura_id,analysis_stage")
    .eq("request_key", requestKey)
    .maybeSingle());

  if (sameTenant.error || !sameTenant.data?.[0] ||
      !sameTenantRequest ||
      sameTenantRequest.status !== "queued" ||
      String(sameTenantRequest.tenant_id) !== tenantB ||
      String(sameTenantRequest.candidatura_id) !== applicationB ||
      sameTenantRequest.analysis_stage !== "prova") {
    throw new Error(
      `same-tenant stage request inválida: rpc=${JSON.stringify(sameTenant)}, queue=${JSON.stringify(sameTenantRequest)}`,
    );
  }

  const sha256 = (value) => crypto.createHash("sha256").update(value).digest("hex");
  const tenantRateSubjectHash = sha256(`stage-analysis:tenant:${tenantB}`);
  const candidateRateSubjectHash = sha256(`stage-analysis:candidate:${tenantB}:${candidateB}`);

  for (let nota = 2; nota <= 30; nota += 1) {
    const retry = await sameTenantClient.rpc("rpc_solicitar_analise_estagio", {
      p_candidatura_id: applicationB,
      p_analysis_stage: "prova",
      p_input_snapshot: { nota },
      p_force: false,
    });
    if (retry.error || !retry.data?.[0] || retry.data[0].analysis_status !== "queued") {
      throw new Error(`stage rate limit atingido antes da hora (nota=${nota}): ${JSON.stringify(retry.error)}`);
    }
  }

  const fillTenant = await must("prepare tenant rate-limit assertion", admin.from("edge_rate_limits")
    .update({ request_count: 1, updated_at: new Date().toISOString() })
    .eq("scope", "candidate_stage_analysis_tenant")
    .eq("subject_hash", tenantRateSubjectHash)
    .eq("window_seconds", 3600));

  const fillCandidate = await must("prepare candidate rate-limit assertion", admin.from("edge_rate_limits")
    .update({ request_count: 30, updated_at: new Date().toISOString() })
    .eq("scope", "candidate_stage_analysis_candidate")
    .eq("subject_hash", candidateRateSubjectHash)
    .eq("window_seconds", 3600));

  if (!fillTenant || !fillCandidate) {
    throw new Error("Falha ao preparar os buckets de rate limit.");
  }

  const forcedAtLimit = await sameTenantClient.rpc("rpc_solicitar_analise_estagio", {
    p_candidatura_id: applicationB,
    p_analysis_stage: "prova",
    p_input_snapshot: { nota: 30 },
    p_force: true,
  });

  const queueAfterCandidateLimit = await must("candidate-limit queue verification", admin
    .from("ai_analysis_requests")
    .select("request_key,status,input_snapshot")
    .eq("request_key", requestKey)
    .maybeSingle());

  if (!forcedAtLimit.error ||
      !/stage_analysis_rate_limited/.test(forcedAtLimit.error.message || "") ||
      queueAfterCandidateLimit?.input_snapshot?.stage_input?.nota !== 30) {
    throw new Error(
      `limite por candidato não bloqueou antes da fila: rpc=${JSON.stringify(forcedAtLimit.error)}, queue=${JSON.stringify(queueAfterCandidateLimit)}`,
    );
  }

  await must("reset candidate bucket for tenant-limit assertion", admin.from("edge_rate_limits")
    .update({ request_count: 1, updated_at: new Date().toISOString() })
    .eq("scope", "candidate_stage_analysis_candidate")
    .eq("subject_hash", candidateRateSubjectHash)
    .eq("window_seconds", 3600));

  await must("prepare tenant bucket limit", admin.from("edge_rate_limits")
    .update({ request_count: 300, updated_at: new Date().toISOString() })
    .eq("scope", "candidate_stage_analysis_tenant")
    .eq("subject_hash", tenantRateSubjectHash)
    .eq("window_seconds", 3600));

  const tenantAtLimit = await sameTenantClient.rpc("rpc_solicitar_analise_estagio", {
    p_candidatura_id: applicationB,
    p_analysis_stage: "prova",
    p_input_snapshot: { nota: 31 },
    p_force: false,
  });

  const queueAfterTenantLimit = await must("tenant-limit queue verification", admin
    .from("ai_analysis_requests")
    .select("request_key,status,input_snapshot")
    .eq("request_key", requestKey)
    .maybeSingle());

  if (!tenantAtLimit.error ||
      !/stage_analysis_rate_limited/.test(tenantAtLimit.error.message || "") ||
      queueAfterTenantLimit?.input_snapshot?.stage_input?.nota !== 30) {
    throw new Error(
      `limite por empresa não bloqueou antes da fila: rpc=${JSON.stringify(tenantAtLimit.error)}, queue=${JSON.stringify(queueAfterTenantLimit)}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    runId,
    cross_tenant_status: crossTenant.error?.message ?? "denied",
    same_tenant_status: sameTenant.data[0].analysis_status,
    stage_rate_limit_candidate: true,
    stage_rate_limit_tenant: true,
    queue_request: sameTenantRequest,
  }, null, 2));
} finally {
  await admin.from("ai_analysis_requests").delete().eq("request_key", requestKey);
  await admin.from("edge_rate_limits").delete().eq("scope", "candidate_stage_analysis_tenant").eq("subject_hash", tenantRateSubjectHash).eq("window_seconds", 3600);
  await admin.from("edge_rate_limits").delete().eq("scope", "candidate_stage_analysis_candidate").eq("subject_hash", candidateRateSubjectHash).eq("window_seconds", 3600);
  await admin.from("analise_ia_candidato").delete().eq("candidatura_id", applicationB);
  await admin.from("candidatura_eventos").delete().eq("candidatura_id", applicationB);
  await admin.from("candidaturas").delete().eq("id", applicationB);
  await admin.from("candidatos").delete().eq("id", candidateB);
  if (authUserId) {
    await admin.from("tenant_memberships").delete().eq("tenant_id", tenantB).eq("user_id", authUserId);
    await admin.auth.admin.deleteUser(authUserId);
  }
  await admin.from("vagas").delete().eq("id", vacancyB);
  await admin.from("tenants").delete().in("id", [tenantA, tenantB]);
  console.log("Fixtures de isolamento de estágio removidas.");
}
