import { supabase } from "./supabase";

export interface CurrentCandidate {
  id: string;
  tenant_id: string;
  user_id: string | null;
  nome: string;
  email: string | null;
  telefone: string | null;
  linkedin: string | null;
  resumo: string | null;
  foto_url: string | null;
  resume_data: Record<string, unknown> | null;
}

export async function loadCurrentCandidate(
  tenantId: string,
  userId: string,
): Promise<CurrentCandidate | null> {
  const { data, error } = await supabase
    .from("candidatos")
    .select(
      "id, tenant_id, user_id, nome, email, telefone, linkedin, resumo, foto_url, resume_data",
    )
    .eq("tenant_id", tenantId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as CurrentCandidate | null;
}

export async function registerCurrentCandidate(
  tenantId: string,
): Promise<CurrentCandidate> {
  const { data, error } = await supabase.rpc("rpc_registrar_candidato", {
    p_tenant_id: tenantId,
  });

  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  const candidateId = row?.candidato_id;
  if (!candidateId) throw new Error("Não foi possível registrar o candidato nesta empresa.");

  const candidate = await loadCurrentCandidate(
    tenantId,
    (await supabase.auth.getUser()).data.user?.id || "",
  );

  if (!candidate) throw new Error("Cadastro do candidato não foi localizado após o registro.");
  return candidate;
}
