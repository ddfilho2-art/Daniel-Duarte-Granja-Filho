import { supabase } from './supabase';

export type EventoTipo = 'APROVADO' | 'REPROVADO' | 'RESERVA' | 'MENSAGEM' | 'PROVA' | 'FASE' | 'STATUS' | 'COMENTARIO';

export async function logCandidaturaEvento(
  candidaturaId: string,
  tipo: EventoTipo,
  descricao: string,
  usuarioId?: string
) {
  try {
    let currentUserId = usuarioId;
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      currentUserId = user?.id;
    }

    const { error } = await supabase.from('candidatura_eventos').insert({
      candidatura_id: candidaturaId,
      tipo,
      descricao,
      usuario_id: currentUserId || null,
      created_at: new Date().toISOString()
    });

    if (error) {
      console.warn('Erro ao registrar evento de candidatura:', error.message);
    }
  } catch (error: any) {
    console.warn('Erro ao registrar evento de candidatura:', error);
  }
}
