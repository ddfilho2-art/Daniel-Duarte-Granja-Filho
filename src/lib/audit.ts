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

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    const tenantId = getSupabaseTenantId();

    console.info("[LOG DEBUG]", {
      sessionPresent: Boolean(session),
      userPresent: Boolean(session?.user),
      tenantPresent: Boolean(tenantId),
    });

    if (sessionError || !session?.user) {
      console.warn(
        "[AUDIT] Log não enviado porque não existe sessão autenticada.",
        sessionError?.message || "session_absent",
      );
      return;
    }

    if (!currentUserId) {
      currentUserId = session.user.id;
    }
    currentUserEmail = session.user.email || null;

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
