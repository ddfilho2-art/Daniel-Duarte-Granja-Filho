import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error("Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no ambiente local. Nunca coloque esses valores no Git.");
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const email = `e2e-candidato-${runId}@example.invalid`;
const password = `E2eRun!${crypto.randomBytes(12).toString("hex")}A1`;
const slug = `e2e-${runId}`;
const cnpj = "000000000" + runId.slice(0, 5);
let tenantId = null;
let candidateUserId = null;
let candidateId = null;
let vagaId = null;
let candidaturaId = null;
let requestKey = null;

const checks = {};
const FETCH_TIMEOUT_MS = Number(process.env.E2E_FETCH_TIMEOUT_MS || 60000);

async function fetchWithTimeout(url, options = {}) {
  return fetch(url, { ...options, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
}

async function must(label, operation) {
  const { data, error } = await operation;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

try {
  console.log("\n=== Recruta AÍ — E2E completo ===");
  console.log("Run:", runId);

  // Tenant temporário: criado diretamente pelo harness para manter o teste
  // independente de dados reais. O fluxo de candidatura continua sendo o oficial.
  const tenant = await must("tenant", admin.from("tenants").insert({
    kind: "employer",
    cnpj,
    legal_name: `Recruta AÍ E2E ${runId}`,
    display_name: `Recruta AÍ E2E ${runId}`,
    slug,
    status: "active",
    metadata: { e2e: true, run_id: runId },
  }).select("id").single());
  tenantId = tenant.id;
  checks.tenant = true;

  const created = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { nome: `Candidato E2E ${runId}`, perfil: "Candidato" },
  });
  if (created.error || !created.data.user) {
    throw new Error("auth_candidate: " + (created.error?.message || "sem usuário"));
  }
  candidateUserId = created.data.user.id;

  const resumeData = {
    nome: `Candidato E2E ${runId}`,
    telefone: "21999990000",
    escolaridade: "Superior completo",
    experiencias: [{
      cargo: "Analista de Processos",
      empresa: "Empresa E2E",
      periodo: "2022-2026",
      descricao: "BPMN, melhoria contínua, automação e análise de processos.",
    }],
    formacoes: [{
      curso: "Administração",
      instituicao: "Instituição E2E",
      nivel: "Superior",
    }],
    habilidades: ["BPMN", "Excel", "Automação", "Melhoria Contínua"],
    resumo: "Currículo temporário para homologação.",
  };

  await must("users", admin.from("users").insert({
    id: candidateUserId,
    uid: candidateUserId,
    nome: resumeData.nome,
    email,
    login: email,
    login_lower: email.toLowerCase(),
    perfil: "Candidato",
    status: "Ativo",
    resume_completed: true,
    resume_data: resumeData,
  }));
  checks.candidate_profile = true;

  const vacancy = await must("vacancy", admin.from("vagas").insert({
    titulo: "Analista de Processos E2E",
    descricao: "Mapeamento, análise e melhoria de processos, BPMN e automação.",
    departamento: "Processos",
    local: "Remoto",
    tipo_contrato: "CLT",
    requisitos: "Experiência em processos, BPMN, melhoria contínua e automação.",
    beneficios: "Benefícios E2E",
    exige_prova: false,
    status: "Aberta",
    proprietario_id: candidateUserId,
    tenant_id: tenantId,
  }).select("id").single());
  vagaId = vacancy.id;
  checks.vacancy = true;

  const candidateClient = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const signed = await candidateClient.auth.signInWithPassword({ email, password });
  if (signed.error || !signed.data.session) {
    throw new Error("candidate_signin: " + (signed.error?.message || "sem sessão"));
  }
  checks.auth = true;

  const apply = await fetchWithTimeout(`${supabaseUrl}/functions/v1/apply-to-vacancy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${signed.data.session.access_token}`,
    },
    body: JSON.stringify({ vaga_id: vagaId, origem: "E2E" }),
  });
  const applyBody = await apply.json().catch(() => ({}));
  if (!apply.ok || !applyBody.success) {
    throw new Error("apply-to-vacancy: " + JSON.stringify(applyBody));
  }

  candidaturaId = String(applyBody.candidatura_id || "");
  requestKey = String(
    applyBody.analysis_request_key ||
    `candidate-analysis:${tenantId}:${candidaturaId}`,
  );
  if (!candidaturaId) throw new Error("apply-to-vacancy não retornou candidatura_id");
  const createdCandidate = await must("candidate", admin.from("candidatos")
    .select("id,user_id")
    .eq("user_id", candidateUserId)
    .eq("nome", resumeData.nome)
    .maybeSingle());
  if (!createdCandidate?.id) throw new Error("candidatos não foi sincronizado pela candidatura");
  candidateId = createdCandidate.id;
  checks.candidate_record = true;
  checks.application = true;

  const queueRequest = await must("queue binding", admin.from("ai_analysis_requests")
    .select("request_key,candidatura_id,candidato_id,vaga_id,tenant_id,status,input_hash")
    .eq("request_key", requestKey)
    .single());
  if (String(queueRequest.candidatura_id) !== candidaturaId ||
      String(queueRequest.candidato_id) !== String(candidateId) ||
      String(queueRequest.vaga_id) !== String(vagaId) ||
      String(queueRequest.tenant_id) !== String(tenantId)) {
    throw new Error("fila não está vinculada à candidatura/candidato/vaga/tenant esperados");
  }
  checks.queue_binding = {
    candidatura_id: queueRequest.candidatura_id,
    candidato_id: queueRequest.candidato_id,
    vaga_id: queueRequest.vaga_id,
    tenant_id: queueRequest.tenant_id,
    status: queueRequest.status,
  };

  // O endpoint real já dispara o worker. A chamada explícita abaixo torna
  // o teste determinístico quando waitUntil não executa imediatamente.
  for (let attempt = 0; attempt < 5; attempt++) {
    const worker = await fetchWithTimeout(`${supabaseUrl}/functions/v1/candidate-analysis-worker`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ max_jobs: 3 }),
    });
    const workerBody = await worker.json().catch(() => ({}));
    checks[`worker_${attempt + 1}`] = { status: worker.status, body: workerBody };

    const analysis = await must("analysis", admin.from("analise_ia_candidato")
      .select("id,status,result,error,candidatura_id")
      .eq("candidatura_id", candidaturaId)
      .eq("tenant_id", tenantId)
      .maybeSingle());

    const application = await must("candidatura", admin.from("candidaturas")
      .select("id,score_ia,fase,status,tenant_id")
      .eq("id", candidaturaId)
      .maybeSingle());

    if (analysis?.status === "completed" && application?.score_ia != null) {
      const r = analysis.result || {};
      const axes = [
        Number(r.score_tecnico),
        Number(r.score_experiencia),
        Number(r.score_formacao),
        Number(r.score_soft_skills),
        Number(r.score_cultura),
      ];
      if (axes.some((v) => !Number.isFinite(v) || v < 0 || v > 100)) {
        throw new Error("radar inválido");
      }
      const expected = Math.round((axes.reduce((a, b) => a + b, 0) / 5) * 100) / 100;
      checks.analysis = {
        status: analysis.status,
        radar: {
          tecnico: axes[0],
          experiencia: axes[1],
          formacao: axes[2],
          soft_skills: axes[3],
          cultura: axes[4],
        },
        score_total: Number(r.score_total),
        score_ia: Number(application.score_ia),
        expected_score: expected,
      };
      checks.score = Number(r.score_total) === expected &&
        Number(application.score_ia) === expected;
      break;
    }

    if (attempt === 4) {
      throw new Error(`análise não concluiu: ${JSON.stringify({ analysis, application })}`);
    }
  }

  const duplicate = await fetchWithTimeout(`${supabaseUrl}/functions/v1/apply-to-vacancy`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: anonKey,
      Authorization: `Bearer ${signed.data.session.access_token}`,
    },
    body: JSON.stringify({ vaga_id: vagaId, origem: "E2E_DUPLICATE" }),
  });
  const duplicateBody = await duplicate.json().catch(() => ({}));
  checks.duplicate = {
    http_status: duplicate.status,
    code: duplicateBody.code || null,
    rejected: duplicateBody.code === "already_applied",
  };

  if (!checks.score) throw new Error("score persistido não corresponde à média do radar");
  if (!checks.duplicate.rejected) throw new Error("segunda candidatura não foi bloqueada");

  const failedChecks = Object.entries(checks)
    .filter(([key, value]) => key === "score" ? value !== true : false)
    .map(([key]) => key);
  if (failedChecks.length) throw new Error("checks failed: " + failedChecks.join(", "));

  console.log(JSON.stringify({ ok: true, runId, checks }, null, 2));
} finally {
  console.log("\nLimpando fixtures E2E...");
  if (candidaturaId) {
    await admin.from("candidatura_eventos").delete().eq("candidatura_id", candidaturaId);
    await admin.from("analise_ia_candidato").delete().eq("candidatura_id", candidaturaId);
    await admin.from("ai_analysis_requests").delete().eq("request_key", requestKey);
    await admin.from("candidaturas").delete().eq("id", candidaturaId);
  }
  if (vagaId) await admin.from("vagas").delete().eq("id", vagaId);
  if (candidateId) await admin.from("candidatos").delete().eq("id", candidateId);
  if (candidateUserId) {
    await admin.from("candidatos").delete().eq("user_id", candidateUserId);
    await admin.from("users").delete().eq("id", candidateUserId);
    await admin.auth.admin.deleteUser(candidateUserId);
  }
  if (tenantId) await admin.from("tenants").delete().eq("id", tenantId);
  console.log("Fixtures removidas.");
}
