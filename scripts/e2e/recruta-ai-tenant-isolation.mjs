import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !anonKey || !serviceRoleKey) {
  throw new Error(
    "Defina SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY no ambiente local. Nunca coloque esses valores no Git.",
  );
}

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const password = `Isolation!E2E${crypto.randomBytes(10).toString("hex")}A1`;
const tenantA = { slug: `e2e-iso-a-${runId}`, name: `E2E Isolation A ${runId}` };
const tenantB = { slug: `e2e-iso-b-${runId}`, name: `E2E Isolation B ${runId}` };
const userAEmail = `e2e-iso-a-${runId}@example.invalid`;
const userBEmail = `e2e-iso-b-${runId}@example.invalid`;

let tenantAId = null;
let tenantBId = null;
let userAId = null;
let userBId = null;
let candidateAId = null;
let candidateBId = null;
let vacancyAId = null;
let vacancyBId = null;
let applicationAId = null;
let applicationBId = null;

const results = {};

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function must(label, operation) {
  const { data, error } = await operation;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

async function expectDenied(label, operation) {
  const { data, error } = await operation;
  if (error) {
    results[label] = { passed: true, error: error.message };
    return;
  }
  throw new Error(`${label}: operação deveria ter sido bloqueada, mas retornou sucesso: ${JSON.stringify(data)}`);
}

async function cleanup(label, operation, errors) {
  const { error } = await operation;
  if (error) errors.push(`${label}: ${error.message}`);
}

try {
  console.log("\n=== Recruta AÍ — E2E isolamento multi-tenant real ===");
  console.log("Run:", runId);

  const createdTenants = await must("tenants", admin.from("tenants").insert([
    {
      kind: "employer",
      cnpj: "000000000" + runId.slice(0, 5),
      legal_name: tenantA.name,
      display_name: tenantA.name,
      slug: tenantA.slug,
      status: "active",
      metadata: { e2e: true, isolation_run: runId, fixture: "A" },
    },
    {
      kind: "employer",
      cnpj: "000000001" + runId.slice(0, 5),
      legal_name: tenantB.name,
      display_name: tenantB.name,
      slug: tenantB.slug,
      status: "active",
      metadata: { e2e: true, isolation_run: runId, fixture: "B" },
    },
  ]).select("id,slug"));

  tenantAId = createdTenants.find((x) => x.slug === tenantA.slug)?.id;
  tenantBId = createdTenants.find((x) => x.slug === tenantB.slug)?.id;
  assert(tenantAId && tenantBId, "tenants E2E não foram criados");
  results.tenants = { passed: true, tenantAId, tenantBId };

  const authA = await admin.auth.admin.createUser({
    email: userAEmail,
    password,
    email_confirm: true,
    user_metadata: { nome: `Candidato A ${runId}`, perfil: "Candidato" },
  });
  if (authA.error || !authA.data.user) throw new Error("Auth A: " + (authA.error?.message || "sem usuário"));
  userAId = authA.data.user.id;

  const authB = await admin.auth.admin.createUser({
    email: userBEmail,
    password,
    email_confirm: true,
    user_metadata: { nome: `Candidato B ${runId}`, perfil: "Candidato" },
  });
  if (authB.error || !authB.data.user) throw new Error("Auth B: " + (authB.error?.message || "sem usuário"));
  userBId = authB.data.user.id;

  const resume = (nome) => ({
    nome,
    telefone: "21999990000",
    escolaridade: "Superior completo",
    experiencias: [{ cargo: "Analista", empresa: "E2E", periodo: "2024-2026", descricao: "Processos e automação." }],
    formacoes: [{ curso: "Administração", instituicao: "E2E", nivel: "Superior" }],
    habilidades: ["BPMN", "Automação"],
  });

  await must("users A", admin.from("users").update({
    nome: `Candidato A ${runId}`,
    email: userAEmail,
    login: userAEmail,
    login_lower: userAEmail.toLowerCase(),
    perfil: "Candidato",
    status: "Ativo",
    resume_completed: true,
    resume_data: resume(`Candidato A ${runId}`),
  }).eq("id", userAId));

  await must("users B", admin.from("users").update({
    nome: `Candidato B ${runId}`,
    email: userBEmail,
    login: userBEmail,
    login_lower: userBEmail.toLowerCase(),
    perfil: "Candidato",
    status: "Ativo",
    resume_completed: true,
    resume_data: resume(`Candidato B ${runId}`),
  }).eq("id", userBId));

  const clientA = createClient(supabaseUrl, anonKey, {
    global: { headers: { "x-tenant-id": tenantAId } },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const clientB = createClient(supabaseUrl, anonKey, {
    global: { headers: { "x-tenant-id": tenantBId } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const signedA = await clientA.auth.signInWithPassword({ email: userAEmail, password });
  if (signedA.error || !signedA.data.session) throw new Error("sign-in A: " + (signedA.error?.message || "sem sessão"));

  const signedB = await clientB.auth.signInWithPassword({ email: userBEmail, password });
  if (signedB.error || !signedB.data.session) throw new Error("sign-in B: " + (signedB.error?.message || "sem sessão"));
  results.auth = { passed: true };

  const regA = await must("registrar candidato A", clientA.rpc("rpc_registrar_candidato", { p_tenant_id: tenantAId }));
  const regB = await must("registrar candidato B", clientB.rpc("rpc_registrar_candidato", { p_tenant_id: tenantBId }));
  candidateAId = String(regA[0].candidato_id);
  candidateBId = String(regB[0].candidato_id);
  assert(candidateAId && candidateBId && candidateAId !== candidateBId, "fichas de candidatos não ficaram isoladas");
  results.registration = { passed: true, candidateAId, candidateBId };

  const [vacA, vacB] = await Promise.all([
    must("vaga A", admin.from("vagas").insert({
      titulo: `Vaga A ${runId}`,
      descricao: "Vaga exclusiva do tenant A.",
      status: "Aberta",
      tenant_id: tenantAId,
      departamento: "A",
    }).select("id").single()),
    must("vaga B", admin.from("vagas").insert({
      titulo: `Vaga B ${runId}`,
      descricao: "Vaga exclusiva do tenant B.",
      status: "Aberta",
      tenant_id: tenantBId,
      departamento: "B",
    }).select("id").single()),
  ]);
  vacancyAId = vacA.id;
  vacancyBId = vacB.id;

  const visibleA = await must("vagas visíveis A", clientA.from("vagas").select("id,tenant_id,titulo").order("titulo"));
  const visibleB = await must("vagas visíveis B", clientB.from("vagas").select("id,tenant_id,titulo").order("titulo"));
  assert(visibleA.length === 1 && visibleA[0].id === vacancyAId, `Tenant A viu dados indevidos: ${JSON.stringify(visibleA)}`);
  assert(visibleB.length === 1 && visibleB[0].id === vacancyBId, `Tenant B viu dados indevidos: ${JSON.stringify(visibleB)}`);
  results.vacancy_select_isolation = { passed: true, tenantA: visibleA.length, tenantB: visibleB.length };

  const candidatesA = await must("candidatos visíveis A", clientA.from("candidatos").select("id,tenant_id,user_id"));
  const candidatesB = await must("candidatos visíveis B", clientB.from("candidatos").select("id,tenant_id,user_id"));
  assert(candidatesA.length === 1 && candidatesA[0].id === candidateAId, `Tenant A viu candidato indevido: ${JSON.stringify(candidatesA)}`);
  assert(candidatesB.length === 1 && candidatesB[0].id === candidateBId, `Tenant B viu candidato indevido: ${JSON.stringify(candidatesB)}`);
  results.candidate_select_isolation = { passed: true, tenantA: candidatesA.length, tenantB: candidatesB.length };

  const appA = await must("candidatura A", admin.from("candidaturas").insert({
    vaga_id: vacancyAId,
    candidato_id: candidateAId,
    tenant_id: tenantAId,
    fase: "Triagem",
    status: "NOVO",
    historico: [],
  }).select("id").single());
  const appB = await must("candidatura B", admin.from("candidaturas").insert({
    vaga_id: vacancyBId,
    candidato_id: candidateBId,
    tenant_id: tenantBId,
    fase: "Triagem",
    status: "NOVO",
    historico: [],
  }).select("id").single());
  applicationAId = appA.id;
  applicationBId = appB.id;

  const appsA = await must("candidaturas visíveis A", clientA.from("candidaturas").select("id,tenant_id,candidato_id,vaga_id"));
  const appsB = await must("candidaturas visíveis B", clientB.from("candidaturas").select("id,tenant_id,candidato_id,vaga_id"));
  assert(appsA.length === 1 && appsA[0].id === applicationAId, `Tenant A viu candidatura indevida: ${JSON.stringify(appsA)}`);
  assert(appsB.length === 1 && appsB[0].id === applicationBId, `Tenant B viu candidatura indevida: ${JSON.stringify(appsB)}`);
  results.application_select_isolation = { passed: true, tenantA: appsA.length, tenantB: appsB.length };

  const crossVacancyA = await must("A consulta vaga B", clientA.from("vagas").select("id").eq("id", vacancyBId));
  const crossCandidateA = await must("A consulta candidato B", clientA.from("candidatos").select("id").eq("id", candidateBId));
  const crossApplicationA = await must("A consulta candidatura B", clientA.from("candidaturas").select("id").eq("id", applicationBId));
  assert(crossVacancyA.length === 0, "Tenant A conseguiu consultar vaga B");
  assert(crossCandidateA.length === 0, "Tenant A conseguiu consultar candidato B");
  assert(crossApplicationA.length === 0, "Tenant A conseguiu consultar candidatura B");
  results.direct_cross_tenant_reads = { passed: true };

  await expectDenied("A insere vaga em B", clientA.from("vagas").insert({
    titulo: "Tentativa cross-tenant",
    descricao: "Deve ser bloqueada.",
    status: "Aberta",
    tenant_id: tenantBId,
  }));

  await expectDenied("A altera candidato para B", clientA.from("candidatos")
    .update({ tenant_id: tenantBId })
    .eq("id", candidateAId));

  await expectDenied("A insere candidatura em B", clientA.from("candidaturas").insert({
    vaga_id: vacancyBId,
    candidato_id: candidateAId,
    tenant_id: tenantBId,
    fase: "Triagem",
    status: "NOVO",
    historico: [],
  }));

  results.cross_tenant_writes = { passed: true };

  const tenantsA = await must("tenant B via tenant A", clientA.from("tenants").select("id").eq("id", tenantBId));
  assert(tenantsA.length === 0, "Tenant A conseguiu consultar o registro do tenant B");
  results.tenant_record_isolation = { passed: true };

  const ownUserUnderWrongTenant = await must(
    "self user under wrong tenant context",
    clientA.from("users").select("id,uid").eq("id", userAId),
  );
  assert(ownUserUnderWrongTenant.length === 1, "A política de users deixou de permitir o próprio usuário");
  results.user_self_access = { passed: true };

  console.log(JSON.stringify({ ok: true, runId, results }, null, 2));
} finally {
  console.log("\nLimpando fixtures de isolamento...");
  const errors = [];

  if (applicationAId) await cleanup("candidatura A", admin.from("candidaturas").delete().eq("id", applicationAId), errors);
  if (applicationBId) await cleanup("candidatura B", admin.from("candidaturas").delete().eq("id", applicationBId), errors);
  if (vacancyAId) await cleanup("vaga A", admin.from("vagas").delete().eq("id", vacancyAId), errors);
  if (vacancyBId) await cleanup("vaga B", admin.from("vagas").delete().eq("id", vacancyBId), errors);
  if (candidateAId) await cleanup("candidato A", admin.from("candidatos").delete().eq("id", candidateAId), errors);
  if (candidateBId) await cleanup("candidato B", admin.from("candidatos").delete().eq("id", candidateBId), errors);
  if (tenantAId && userAId) await cleanup("membership A", admin.from("tenant_memberships").delete().eq("tenant_id", tenantAId).eq("user_id", userAId), errors);
  if (tenantBId && userBId) await cleanup("membership B", admin.from("tenant_memberships").delete().eq("tenant_id", tenantBId).eq("user_id", userBId), errors);
  if (userAId) {
    const x = await admin.auth.admin.deleteUser(userAId);
    if (x.error) errors.push("auth A: " + x.error.message);
    await cleanup("users A", admin.from("users").delete().eq("id", userAId), errors);
  }
  if (userBId) {
    const x = await admin.auth.admin.deleteUser(userBId);
    if (x.error) errors.push("auth B: " + x.error.message);
    await cleanup("users B", admin.from("users").delete().eq("id", userBId), errors);
  }
  if (tenantAId) await cleanup("tenant A", admin.from("tenants").delete().eq("id", tenantAId), errors);
  if (tenantBId) await cleanup("tenant B", admin.from("tenants").delete().eq("id", tenantBId), errors);

  if (errors.length) {
    console.error("Falhas na limpeza:");
    errors.forEach((x) => console.error(" - " + x));
    throw new Error("E2E terminou com resíduos de limpeza.");
  }
  console.log("Fixtures removidas.");
}
