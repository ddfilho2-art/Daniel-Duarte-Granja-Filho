import { supabase } from "./supabase";

export interface TenantAdmin {
  id: string;
  user_id: string;
  roles: string[];
  status: string;
  activated_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
  user: {
    id: string;
    nome: string;
    email: string;
    login: string | null;
    perfil: string;
    status: string;
  } | null;
}

export interface TenantAdminOperation {
  id: string;
  tenant_id: string;
  operation_type: "add" | "replace" | "revoke";
  target_user_id: string | null;
  previous_user_id: string | null;
  actor_id: string | null;
  effective_at: string;
  justification: string;
  created_at: string;
  target_user?: { id: string; nome: string; email: string } | null;
  previous_user?: { id: string; nome: string; email: string } | null;
  actor?: { id: string; nome: string; email: string } | null;
}

export interface AdminAttachment {
  id: string;
  operation_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
}

interface EdgeResponse<T = unknown> {
  success: boolean;
  code?: string;
  message?: string;
  requestId?: string;
  data?: T;
}

async function callEdge<T>(
  action: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke<EdgeResponse<T>>(
    "tenant-admin-management",
    { body: { action, ...body } },
  );

  if (error) throw new Error(error.message || "Edge function error");
  if (!data?.success) throw new Error(data?.message || data?.code || "Operation failed");
  return data.data as T;
}

export function listTenantAdmins(tenantId: string) {
  return callEdge<TenantAdmin[]>("list_admins", { tenantId });
}

export function listTenantAdminHistory(tenantId: string) {
  return callEdge<TenantAdminOperation[]>("history", { tenantId });
}

export function addTenantAdmin(payload: {
  tenantId: string;
  email?: string;
  nome?: string;
  password?: string;
  userId?: string;
  effectiveAt?: string;
  justification: string;
}) {
  return callEdge<{ operation_id: string; assignment_id: string | null }>(
    "add_admin",
    payload,
  );
}

export function replaceTenantAdmin(payload: {
  tenantId: string;
  previousUserId: string;
  email?: string;
  nome?: string;
  password?: string;
  userId?: string;
  effectiveAt?: string;
  justification: string;
}) {
  return callEdge<{ operation_id: string; assignment_id: string | null }>(
    "replace_admin",
    payload,
  );
}

export function revokeTenantAdmin(payload: {
  tenantId: string;
  userId: string;
  effectiveAt?: string;
  justification: string;
}) {
  return callEdge<{ operation_id: string; assignment_id: string | null }>(
    "revoke_admin",
    payload,
  );
}

export async function createTenantAdminAttachment(
  tenantId: string,
  operationId: string,
  file: File,
): Promise<AdminAttachment> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 180);
  const path = operationId + "/" + crypto.randomUUID() + "-" + safeName;

  const { error: uploadError } = await supabase.storage
    .from("tenant-admin-attachments")
    .upload(path, file, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw new Error(uploadError.message);

  try {
    return await callEdge<AdminAttachment>("register_attachment", {
      tenantId,
      operationId,
      storagePath: path,
      fileName: file.name,
      mimeType: file.type || null,
      sizeBytes: file.size,
    });
  } catch (error) {
    await supabase.storage.from("tenant-admin-attachments").remove([path]);
    throw error;
  }
}


export async function listTenantAdminAttachments(
  operationId: string,
): Promise<AdminAttachment[]> {
  const { data, error } = await supabase
    .from("tenant_admin_operation_attachments")
    .select("*")
    .eq("operation_id", operationId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data || [];
}

export async function createTenantAdminAttachmentSignedUrl(
  storagePath: string,
): Promise<string> {
  const { data, error } = await supabase.storage
    .from("tenant-admin-attachments")
    .createSignedUrl(storagePath, 300);

  if (error || !data?.signedUrl) {
    throw new Error(error?.message || "Não foi possível abrir o anexo.");
  }

  return data.signedUrl;
}
