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

const runId = crypto.randomUUID().replaceAll("-", "").slice(0, 12);
const base = `21${String(Date.now()).slice(-10)}`;
const tenantA = crypto.randomUUID();
const tenantB = crypto.randomUUID();
const vacancyA = crypto.randomUUID().toString();
const vacancyB = crypto.randomUUID().toString();

async function must(label, operation) {
  const { data, error } = await operation;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

console.log("=== Recruta AÍ — E2E isolamento público de vagas ===");
console.log("Run:", runId);

try {
  await must("tenants", admin.from("tenants").insert([
    {
      id: tenantA,
      kind: "employer",
      cnpj: makeValidCnpj(base),
      legal_name: `Recruta AÍ Public A ${runId}`,
      display_name: `Recruta AÍ Public A ${runId}`,
      slug: `e2e-public-a-${runId}`,
      status: "active",
      metadata: { e2e: true, run_id: runId },
    },
    {
      id: tenantB,
      kind: "employer",
      cnpj: makeValidCnpj(`22${String(Date.now()).slice(-10)}`),
      legal_name: `Recruta AÍ Public B ${runId}`,
      display_name: `Recruta AÍ Public B ${runId}`,
      slug: `e2e-public-b-${runId}`,
      status: "active",
      metadata: { e2e: true, run_id: runId },
    },
  ]));

  await must("vacancies", admin.from("vagas").insert([
    {
      id: vacancyA,
      titulo: `Vaga Pública A ${runId}`,
      descricao: "Vaga pública de teste do tenant A.",
      status: "Aberta",
      tenant_id: tenantA,
    },
    {
      id: vacancyB,
      titulo: `Vaga Pública B ${runId}`,
      descricao: "Vaga pública de teste do tenant B.",
      status: "Aberta",
      tenant_id: tenantB,
    },
  ]));

  const clientA = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-tenant-id": tenantA } },
  });
  const clientB = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { "x-tenant-id": tenantB } },
  });
  const clientWithoutTenant = createClient(supabaseUrl, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const rowsA = await must("tenant A public read", clientA
    .from("vagas")
    .select("id,tenant_id")
    .in("id", [vacancyA, vacancyB]));
  const rowsB = await must("tenant B public read", clientB
    .from("vagas")
    .select("id,tenant_id")
    .in("id", [vacancyA, vacancyB]));
  const rowsWithoutTenant = await must("public read without tenant", clientWithoutTenant
    .from("vagas")
    .select("id,tenant_id")
    .in("id", [vacancyA, vacancyB]));

  const onlyA = rowsA.length === 1 && String(rowsA[0].id) === vacancyA &&
    String(rowsA[0].tenant_id) === tenantA;
  const onlyB = rowsB.length === 1 && String(rowsB[0].id) === vacancyB &&
    String(rowsB[0].tenant_id) === tenantB;
  const noneWithoutTenant = rowsWithoutTenant.length === 0;

  if (!onlyA || !onlyB || !noneWithoutTenant) {
    throw new Error(
      `isolamento público inválido: A=${JSON.stringify(rowsA)}, B=${JSON.stringify(rowsB)}, sem_tenant=${JSON.stringify(rowsWithoutTenant)}`,
    );
  }

  console.log(JSON.stringify({
    ok: true,
    runId,
    tenantA_visible: rowsA,
    tenantB_visible: rowsB,
    without_tenant_visible: rowsWithoutTenant,
  }, null, 2));
} finally {
  await admin.from("vagas").delete().in("id", [vacancyA, vacancyB]);
  await admin.from("tenants").delete().in("id", [tenantA, tenantB]);
  console.log("Fixtures públicas removidas.");
}
