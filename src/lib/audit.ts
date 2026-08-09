import { supabase } from "./supabase";

export async function logAudit(
  acao: string,
  modulo: string,
  detalhes: string,
  userId?: string,
) {
  try {
    let currentUserId = userId;

    if (!currentUserId) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      currentUserId = user?.id;
    }

    const { error } = await supabase.from("logs").insert({
      acao,
      modulo,
      detalhes,
      usuario_id: currentUserId || null,
      user_id: currentUserId || null,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.warn("Erro ao registrar log (não crítico):", error.message);
    }
  } catch (error) {
    console.warn("Erro ao registrar log de auditoria (não crítico):", error);
  }
}
