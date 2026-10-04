import "dotenv/config";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente local. Nunca coloque esses valores no Git.");
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const workerUrl =
  process.env.CANDIDATE_ANALYSIS_WORKER_URL ||
  "https://dmzagrakkduddofkqjhg.supabase.co/functions/v1/candidate-analysis-worker";

const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const prefix = `e2e-real-ai-${runId}-`;
const tenantId = crypto.randomUUID();
const total = Number(process.env.E2E_REAL_AI_JOBS || 4);
const concurrency = Math.min(
  8,
  Math.max(1, Number(process.env.E2E_REAL_AI_CONCURRENCY || 2)),
);
const pollMs = Number(process.env.E2E_REAL_AI_POLL_MS || 2000);
const waveDelayMs = Number(process.env.E2E_REAL_AI_WAVE_DELAY_MS || 18000);
const timeoutMs = Number(process.env.E2E_REAL_AI_TIMEOUT_MS || 360000);

if (!Number.isInteger(total) || total < 1 || total > 200) {
  throw new Error("E2E_REAL_AI_JOBS deve estar entre 1 e 200.");
}
if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > 8) {
  throw new Error("E2E_REAL_AI_CONCURRENCY deve estar entre 1 e 8.");
}
if (concurrency !== 1) {
  throw new Error("E2E_REAL_AI_CONCURRENCY deve ser 1 no teste com cota gratuita de 5 RPM.");
}
if (!Number.isFinite(waveDelayMs) || waveDelayMs < 18000) {
  throw new Error("E2E_REAL_AI_WAVE_DELAY_MS deve ser >= 18000ms para preservar margem na cota gratuita de 5 RPM.");
}

function makeValidCnpj(base12) {
  const digits = String(base12).replace(/\D/g, "").slice(0, 12).padStart(12, "0");
  const weights1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const weights2 = [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const digit = (value, weights) => {
    const sum = value.split("").reduce(
      (acc, char, index) => acc + Number(char) * weights[index],
      0,
    );
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const d1 = digit(digits, weights1);
  const d2 = digit(digits + d1, weights2);
  return digits + d1 + d2;
}

const cnpj = makeValidCnpj(`31${String(Date.now()).slice(-10)}`);
const candidateIds = [];
const vacancyIds = [];
const applicationIds = [];
const requestKeys = [];
let safeToCleanup = false;

async function must(label, promise) {
  const { data, error } = await promise;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashHex(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function candidateRow(i) {
  const id = crypto.randomUUID();
  candidateIds.push(id);
  return {
    id,
    tenant_id: tenantId,
    user_id: null,
    nome: `Candidato IA E2E ${runId}-${String(i + 1).padStart(3, "0")}`,
    email: `e2e-real-ai-${runId}-${i + 1}@example.invalid`,
    telefone: "21999990000",
    resumo: "Profissional de processos com experiência em melhoria contínua, BPMN e automação.",
    resume_data: {
      nome: `Candidato IA E2E ${runId}-${String(i + 1).padStart(3, "0")}`,
      telefone: "21999990000",
      escolaridade: "Superior completo",
      formacoes: [{
        curso: "Administração",
        instituicao: "Instituição E2E",
        nivel: "Superior",
      }],
      experiencias: [{
        cargo: "Analista de Processos",
        empresa: "Empresa E2E",
        periodo: "2021-2026",
        descricao: "BPMN, melhoria contínua, automação, indicadores e análise de processos.",
      }],
      habilidades: ["BPMN", "Lean", "Excel", "Automação", "Power BI"],
      resumo: "Profissional de processos com experiência em melhoria contínua, BPMN e automação.",
    },
  };
}

function vacancyRow(i) {
  const id = crypto.randomUUID();
  vacancyIds.push(id);
  return {
    id,
    tenant_id: tenantId,
    titulo: `Analista de Processos IA E2E ${String(i + 1).padStart(3, "0")}`,
    descricao: "Mapeamento, análise e melhoria de processos, BPMN, automação, indicadores e melhoria contínua.",
    departamento: "Processos",
    local: "Remoto",
    tipo_contrato: "CLT",
    requisitos: "Experiência em processos, BPMN, melhoria contínua, automação e análise de indicadores.",
    beneficios: "Benefícios E2E",
    exige_prova: false,
    status: "Aberta",
  };
}

function applicationRow(candidateId, vacancyId) {
  const id = crypto.randomUUID();
  applicationIds.push(id);
  return {
    id,
    vaga_id: vacancyId,
    candidato_id: candidateId,
    tenant_id: tenantId,
    fase: "Triagem",
    status: "NOVO",
    historico: [{
      status: "Triagem",
      data: new Date().toISOString(),
      entradaFase: new Date().toISOString(),
      usuarioNome: "E2E Real AI",
      origem: "E2E_REAL_AI_LOAD",
    }],
  };
}

function requestRow(i, candidateId, vacancyId, applicationId) {
  const requestKey = `${prefix}${String(i + 1).padStart(4, "0")}`;
  requestKeys.push(requestKey);
  const snapshot = {
    tenant_id: tenantId,
    candidate: {
      id: candidateId,
      nome: `Candidato IA E2E ${runId}-${String(i + 1).padStart(3, "0")}`,
      resumo: "Profissional de processos com experiência em melhoria contínua, BPMN e automação.",
      linkedin: "",
      resume: {
        resumo: "Profissional de processos com experiência em melhoria contínua, BPMN e automação.",
        habilidades: ["BPMN", "Lean", "Excel", "Automação", "Power BI"],
        experiencias: [{
          cargo: "Analista de Processos",
          empresa: "Empresa E2E",
          periodo: "2021-2026",
          descricao: "BPMN, melhoria contínua, automação, indicadores e análise de processos.",
        }],
        formacoes: [{
          curso: "Administração",
          instituicao: "Instituição E2E",
          nivel: "Superior",
        }],
      },
    },
    vacancy: {
      id: vacancyId,
      titulo: `Analista de Processos IA E2E ${String(i + 1).padStart(3, "0")}`,
      descricao: "Mapeamento, análise e melhoria de processos, BPMN, automação, indicadores e melhoria contínua.",
      departamento: "Processos",
      local: "Remoto",
      tipo_contrato: "CLT",
      requisitos: "Experiência em processos, BPMN, melhoria contínua, automação e análise de indicadores.",
      beneficios: "Benefícios E2E",
      status: "Aberta",
      exige_prova: false,
    },
    application: {
      id: applicationId,
      fase: "Triagem",
      status: "NOVO",
      reserva: false,
    },
  };

  return {
    request_key: requestKey,
    actor_id: crypto.randomUUID(),
    candidato_id: candidateId,
    vaga_id: vacancyId,
    candidatura_id: applicationId,
    prompt_version: "candidate-match-v1",
    model: "gemini-2.5-flash",
    input_hash: hashHex(JSON.stringify(snapshot)),
    input_snapshot: snapshot,
    status: "queued",
    tenant_id: tenantId,
    next_attempt_at: new Date().toISOString(),
    analysis_stage: "triagem",
  };
}

async function invokeWorker() {
  const started = Date.now();
  try {
    const res = await fetch(workerUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ max_jobs: 1 }),
    });
    const text = await res.text();
    let body = {};
    try {
      body = JSON.parse(text);
    } catch {
      body = { raw: text.slice(0, 500) };
    }
    return {
      status: res.status,
      ok: res.ok,
      elapsed_ms: Date.now() - started,
      body,
    };
  } catch (error) {
    return {
      status: 0,
      ok: false,
      elapsed_ms: Date.now() - started,
      body: { error: error instanceof Error ? error.message : String(error) },
    };
  }
}

try {
  console.log(`=== Recruta AÍ — carga REAL de IA (${total} jobs / concorrência ${concurrency}) ===`);
  console.log(`Wave delay/backoff-aware: ${waveDelayMs}ms; timeout: ${timeoutMs}ms`);\n  console.log("Modo cota gratuita: 1 invocação do worker por onda, 1 job por invocação.");
  console.log("Modelo alvo: gemini-2.5-flash");
  console.log("Run:", runId);

  const startedAt = Date.now();

  await must("tenant", db.from("tenants").insert({
    id: tenantId,
    kind: "employer",
    cnpj,
    legal_name: `Recruta AÍ Real AI E2E ${runId}`,
    display_name: `Recruta AÍ Real AI E2E ${runId}`,
    slug: `e2e-real-ai-${runId}`,
    status: "active",
    metadata: { e2e: true, run_id: runId, test: "real_ai_load" },
  }));

  const candidates = Array.from({ length: total }, (_, i) => candidateRow(i));
  const vacancies = candidates.map((_, i) => vacancyRow(i));
  const applications = candidates.map((candidate, i) =>
    applicationRow(candidate.id, vacancies[i].id),
  );

  await must("candidates", db.from("candidatos").insert(candidates));
  await must("vacancies", db.from("vagas").insert(vacancies));
  await must("applications", db.from("candidaturas").insert(applications));

  const requests = candidates.map((candidate, i) =>
    requestRow(i, candidate.id, vacancies[i].id, applications[i].id),
  );
  await must("real AI queue", db.from("ai_analysis_requests").insert(requests));

  const workerResults = [];
  const workerStartedAt = Date.now();
  const deadline = Date.now() + timeoutMs;
  let states = [];

  while (Date.now() < deadline) {
    const waveStartedAt = Date.now();
    const wave = await Promise.all(
      Array.from({ length: concurrency }, () => invokeWorker()),
    );
    workerResults.push(...wave);

    states = await must("queue verification", db
      .from("ai_analysis_requests")
      .select("request_key,status,error_code,attempt_count,next_attempt_at,completed_at")
      .like("request_key", `${prefix}%`));

    const terminal = states.filter((x) => x.status === "completed" || x.status === "failed").length;
    const completedNow = states.filter((x) => x.status === "completed").length;
    const failedNow = states.filter((x) => x.status === "failed").length;
    const retryable429 = states.filter((x) =>
      String(x.error_code || "").includes("gemini_retryable_429"),
    ).length;

    console.log(
      `Queue: ${terminal}/${total} terminal; completed=${completedNow}; failed=${failedNow}; retryable_429=${retryable429}; pending=${total - terminal}`,
    );

    if (terminal === total) {
      safeToCleanup = true;
      break;
    }

    const retryAtMs = states
      .filter((x) => x.status === "queued" && x.error_code)
      .map((x) => new Date(x.next_attempt_at).getTime())
      .filter(Number.isFinite)
      .sort((a, b) => a - b)[0];

    let waitMs = waveDelayMs;
    if (Number.isFinite(retryAtMs)) {
      waitMs = Math.max(waitMs, retryAtMs - Date.now());
    } else if (Date.now() - waveStartedAt < pollMs) {
      waitMs = Math.max(waitMs, pollMs - (Date.now() - waveStartedAt));
    }

    await sleep(waitMs);
  }

  const workerElapsedMs = Date.now() - workerStartedAt;

  if (!safeToCleanup) {
    const summary = states.reduce((acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    }, {});
    const retryable429 = states.filter((x) =>
      String(x.error_code || "").includes("gemini_retryable_429"),
    ).length;
    throw new Error(
      `timeout aguardando conclusão da carga real: states=${JSON.stringify(summary)}, retryable_429=${retryable429}`,
    );
  }

  const failed = states.filter((x) => x.status === "failed");
  const completed = states.filter((x) => x.status === "completed");

  const analyses = await must("analysis verification", db
    .from("analise_ia_candidato")
    .select("candidatura_id,status,result,analysis_stage")
    .in("candidatura_id", applicationIds));

  const applicationsState = await must("application score verification", db
    .from("candidaturas")
    .select("id,score_ia")
    .in("id", applicationIds));

  const completedAnalyses = analyses.filter((x) =>
    x.status === "completed" && x.analysis_stage === "triagem" && x.result,
  );
  const scoredApplications = applicationsState.filter((x) => x.score_ia != null);

  const invalidResults = completedAnalyses.filter((x) => {
    const r = x.result || {};
    const axes = [
      Number(r.score_tecnico),
      Number(r.score_experiencia),
      Number(r.score_formacao),
      Number(r.score_soft_skills),
      Number(r.score_cultura),
    ];
    const totalScore = Number(r.score_total);
    return axes.some((v) => !Number.isFinite(v) || v < 0 || v > 100) ||
      !Number.isFinite(totalScore) || totalScore < 0 || totalScore > 100;
  });

  if (failed.length || completed.length !== total || completedAnalyses.length !== total ||
      scoredApplications.length !== total || invalidResults.length) {
    throw new Error(
      `carga real falhou: queued=${total}, completed=${completed.length}, failed=${failed.length}, analyses=${completedAnalyses.length}, scores=${scoredApplications.length}, invalid_results=${invalidResults.length}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    runId,
    total_jobs: total,
    concurrency,
    model: "gemini-2.5-flash",
    completed_jobs: completed.length,
    failed_jobs: failed.length,
    completed_analyses: completedAnalyses.length,
    persisted_scores: scoredApplications.length,
    invalid_results: invalidResults.length,
    worker_invocations: workerResults.length,
    worker_non_2xx: workerResults.filter((x) => !x.ok).length,
    worker_elapsed_ms: workerElapsedMs,
    total_elapsed_ms: Date.now() - startedAt,
    jobs_per_second: Number((total / ((Date.now() - startedAt) / 1000)).toFixed(2)),
    average_worker_invocation_ms: Number(
      (workerResults.reduce((sum, x) => sum + x.elapsed_ms, 0) / workerResults.length).toFixed(2),
    ),
    retry_count: states.reduce((sum, x) => sum + Math.max(0, Number(x.attempt_count) - 1), 0),
  }, null, 2));
} finally {
  if (safeToCleanup) {
    await db.from("ai_analysis_requests").delete().like("request_key", `${prefix}%`);
    if (applicationIds.length) await db.from("analise_ia_candidato").delete().in("candidatura_id", applicationIds);
    if (applicationIds.length) await db.from("candidaturas").delete().in("id", applicationIds);
    if (vacancyIds.length) await db.from("vagas").delete().in("id", vacancyIds);
    if (candidateIds.length) await db.from("candidatos").delete().in("id", candidateIds);
    await db.from("tenants").delete().eq("id", tenantId);
    console.log("Fixtures de carga real removidas.");
  } else {
    console.error("Fixtures preservadas para diagnóstico porque nem todas as filas chegaram a estado terminal.");
  }
}
