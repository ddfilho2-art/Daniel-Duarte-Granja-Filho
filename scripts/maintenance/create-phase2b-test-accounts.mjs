import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Local Supabase URL and service-role key are required.");
}

const url = new URL(supabaseUrl);
if (
  url.protocol !== "http:" ||
  !["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname) ||
  supabaseUrl.includes("dmzagrakkduddofkqjhg")
) {
  throw new Error("Refusing to create fixtures unless Supabase points to a disposable local instance.");
}

const accounts = [
  { email: "master@platform.test", nome: "Platform Test", perfil: "Admin" },
  { email: "admin-a@tenant-a.test", nome: "Admin A", perfil: "Admin" },
  { email: "hr-a@tenant-a.test", nome: "HR A", perfil: "RH" },
  { email: "candidate-a@tenant-a.test", nome: "Candidate A", perfil: "Candidato" },
  { email: "admin-b@tenant-b.test", nome: "Admin B", perfil: "Admin" },
  { email: "hr-b@tenant-b.test", nome: "HR B", perfil: "RH" },
  { email: "clinic@clinic.test", nome: "Clinic Test", perfil: "Admin" },
];

const admin = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

for (const account of accounts) {
  const password = `Tst!-${crypto.randomUUID()}-aA9`;
  const { data, error } = await admin.auth.admin.createUser({
    email: account.email,
    password,
    email_confirm: true,
    user_metadata: { nome: account.nome, perfil: account.perfil },
  });
  if (error) {
    throw new Error(`Failed to create synthetic account ${account.email}: ${error.message}`);
  }
  if (!data.user?.id) {
    throw new Error(`Auth did not return an id for synthetic account ${account.email}`);
  }
  console.log(`Created synthetic Auth fixture: ${account.email}`);
}
console.log(`Created ${accounts.length} synthetic accounts in the disposable local Supabase instance.`);
