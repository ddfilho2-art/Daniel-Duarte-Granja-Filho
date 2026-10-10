import { supabase } from "./supabase";

const BUCKET = "tenant-clinic-chat-attachments";
const MAX_BYTES = 10 * 1024 * 1024;
const MIME_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);

export type TenantClinicConversation = {
  id: string; employer_tenant_id: string; clinic_tenant_id: string; employer_name: string; clinic_name: string; subject: string;
  job_id: string | null; job_title_snapshot: string | null; medical_referral_id: string | null;
  status: "open" | "closed"; created_by: string; created_at: string; updated_at: string;
  last_message_at: string; last_message: string | null; last_sender_side: "employer" | "clinic" | null;
};
export type TenantClinicMessage = {
  id: string; sender_id: string; sender_side: "employer" | "clinic"; body: string;
  created_at: string; read_at: string | null;
};
export type TenantClinicAttachment = {
  id: string; sender_id: string; sender_side: "employer" | "clinic"; storage_path: string;
  original_name: string; mime_type: string; byte_size: number; created_at: string;
};

export async function listTenantClinicConversations() {
  const { data, error } = await supabase.rpc("list_tenant_clinic_conversations_v2");
  if (error) throw new Error("Não foi possível carregar as conversas com a Saúde Ocupacional.");
  return (data || []) as TenantClinicConversation[];
}
export async function createTenantClinicConversation(input: {
  contractId: string; subject: string; jobId?: string | null; medicalReferralId?: string | null; firstMessage: string;
}) {
  const { data, error } = await supabase.rpc("create_tenant_clinic_conversation", {
    p_contract_id: input.contractId, p_subject: input.subject.trim(), p_job_id: input.jobId || null,
    p_medical_referral_id: input.medicalReferralId || null, p_first_message: input.firstMessage.trim() || null,
  });
  if (error || !data) throw new Error("Não foi possível abrir a conversa. Confira o contrato ativo com a clínica.");
  return String(data);
}
export async function listTenantClinicMessages(conversationId: string) {
  const { data, error } = await supabase.rpc("list_tenant_clinic_messages", { p_conversation_id: conversationId });
  if (error) throw new Error("Não foi possível carregar as mensagens desta conversa.");
  return (data || []) as TenantClinicMessage[];
}
export async function sendTenantClinicMessage(conversationId: string, body: string) {
  const { error } = await supabase.rpc("send_tenant_clinic_message", { p_conversation_id: conversationId, p_body: body.trim() });
  if (error?.message?.includes("clinical_details_not_allowed_in_chat")) {
    throw new Error("Não envie detalhes clínicos pelo chat. Utilize o fluxo protegido de documentos ocupacionais.");
  }
  if (error) throw new Error("Não foi possível enviar a mensagem.");
}
export async function listTenantClinicAttachments(conversationId: string) {
  const { data, error } = await supabase.rpc("list_tenant_clinic_attachments", { p_conversation_id: conversationId });
  if (error) throw new Error("Não foi possível listar os anexos desta conversa.");
  return (data || []) as TenantClinicAttachment[];
}
export async function uploadTenantClinicAttachment(conversationId: string, file: File) {
  if (!MIME_TYPES.has(file.type)) throw new Error("Formato não permitido. Envie PDF, PNG ou JPEG.");
  if (file.size < 1 || file.size > MAX_BYTES) throw new Error("O arquivo deve ter no máximo 10 MB.");
  const { data, error } = await supabase.functions.invoke("tenant-clinic-chat-storage", {
    body: { action: "sign_upload", conversationId, fileName: file.name, mimeType: file.type, byteSize: file.size },
  });
  if (error || !data?.success || !data.uploadToken || !data.storagePath) throw new Error("Não foi possível autorizar o envio do anexo.");
  const { error: uploadError } = await supabase.storage.from(BUCKET).uploadToSignedUrl(
    data.storagePath, data.uploadToken, file, { contentType: file.type, upsert: false },
  );
  if (uploadError) throw new Error("O arquivo não foi enviado. Tente novamente.");
}
export async function getTenantClinicAttachmentUrl(conversationId: string, storagePath: string) {
  const { data, error } = await supabase.functions.invoke("tenant-clinic-chat-storage", {
    body: { action: "sign_download", conversationId, storagePath },
  });
  if (error || !data?.success || !data.downloadUrl) throw new Error("Download não autorizado.");
  return String(data.downloadUrl);
}

export type TenantClinicAppointment = {
  id: string;
  conversation_id: string;
  starts_at: string;
  ends_at: string;
  timezone: string;
  status: "pending" | "confirmed" | "cancelled" | "failed";
  google_event_id: string | null;
  created_by: string;
  created_at: string;
  cancellation_reason: string | null;
};
export type BusyInterval = { start: string; end: string };

async function calendarAction(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("google-calendar-appointments", { body });
  if (error || !data?.success) {
    const code = String(data?.code || error?.message || "CALENDAR_OPERATION_FAILED");
    if (code.includes("APPOINTMENT_SLOT_CONFLICT")) throw new Error("Esse horário acabou de ficar indisponível. Consulte os horários novamente.");
    if (code.includes("GOOGLE_") || code.includes("missing_secret")) throw new Error("A integração com Google Calendar ainda não está configurada ou não conseguiu concluir a operação.");
    throw new Error("Não foi possível concluir a operação de agenda.");
  }
  return data;
}
export async function getTenantClinicAvailability(conversationId: string, timeMin: string, timeMax: string, appointmentId?: string | null) {
  const data = await calendarAction({ action: "availability", conversationId, timeMin, timeMax, appointmentId: appointmentId || undefined });
  return (data.busy || []) as BusyInterval[];
}
export async function listTenantClinicAppointments(conversationId: string) {
  const { data, error } = await supabase.rpc("list_tenant_clinic_appointments", { p_conversation_id: conversationId });
  if (error) throw new Error("Não foi possível carregar os agendamentos desta conversa.");
  return (data || []) as TenantClinicAppointment[];
}
export async function bookTenantClinicAppointment(input: {
  conversationId: string; startsAt: string; endsAt: string; timezone: string; idempotencyKey: string;
}) {
  return calendarAction({
    action: "book", conversationId: input.conversationId, startsAt: input.startsAt,
    endsAt: input.endsAt, timezone: input.timezone, idempotencyKey: input.idempotencyKey,
  });
}
export async function rescheduleTenantClinicAppointment(input: {
  appointmentId: string; startsAt: string; endsAt: string; timezone: string;
}) {
  return calendarAction({
    action: "reschedule", appointmentId: input.appointmentId, startsAt: input.startsAt,
    endsAt: input.endsAt, timezone: input.timezone,
  });
}
export async function cancelTenantClinicAppointment(appointmentId: string, reason: string) {
  return calendarAction({ action: "cancel", appointmentId, reason });
}
