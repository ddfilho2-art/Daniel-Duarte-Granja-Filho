import { getSupabaseTenantId, supabase } from "./supabase";

export async function logAudit(
  acao: string,
  modulo: string,
  detalhes: string,
  userId?: string,
) {
  try {
    let currentUserId = userId;
    let currentUserEmail: string | null = null;

    if (!currentUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      currentUserId = user?.id;
      currentUserEmail = user?.email || null;
    }

    const tenantId = getSupabaseTenantId();

    const { error } = await supabase.from("logs").insert({
      acao,
      modulo,
      detalhes,
      usuario_id: currentUserId || null,
      usuario_email: currentUserEmail,
      tenant_id: tenantId || null,
      data: new Date().toISOString(),
    });

    if (error) {
      console.warn("Erro ao registrar log (não crítico):", error.message);
    }
  } catch (error) {
    console.warn("Erro ao registrar log de auditoria (não crítico):", error);
  }
}
