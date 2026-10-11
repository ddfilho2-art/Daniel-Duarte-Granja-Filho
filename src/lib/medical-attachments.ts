import { supabase } from "./supabase";
import { readEdgeFunctionError } from "./function-errors";

interface EdgeResponse {
  success: boolean;
  code?: string;
  requestId?: string;
  message?: string;
  uploadUrl?: string;
  downloadUrl?: string;
  storagePath?: string;
  fileId?: string;
  expiresAt?: string;
}

export interface UploadResult {
  storagePath: string;
  fileId: string;
}

const ALLOWED_MIMES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
]);
const MAX_FILE_SIZE = 10_485_760; // 10 MB

/**
 * Requests a signed upload URL from the storage-authorize Edge Function,
 * uploads the file, and returns the storage path.
 */
export async function uploadMedicalAttachment(
  referralId: string,
  file: File,
): Promise<UploadResult> {
  if (!ALLOWED_MIMES.has(file.type)) {
    throw new Error("Tipo de arquivo não permitido. Use PDF, PNG ou JPEG.");
  }
  if (file.size <= 0 || file.size > MAX_FILE_SIZE) {
    throw new Error("Tamanho máximo permitido: 10 MB.");
  }

  // 1. Request signed upload URL
  const { data, error } =
    await supabase.functions.invoke<EdgeResponse>("storage-authorize", {
      body: {
        action: "sign_upload",
        referralId,
        fileName: file.name,
        mimeType: file.type,
        byteSize: file.size,
      },
    });

  if (error) {
    const errorBody = await readEdgeFunctionError(error);
    throw new Error(
      errorBody.code || "Não foi possível autorizar o upload.",
    );
  }

  if (!data?.success || !data.uploadUrl) {
    throw new Error(data?.code || "Upload não autorizado.");
  }

  // 2. Upload the file using the signed URL
  const uploadResponse = await fetch(data.uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Type": file.type,
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    throw new Error("Falha no upload do arquivo.");
  }

  return {
    storagePath: data.storagePath!,
    fileId: data.fileId!,
  };
}

/**
 * Requests a signed download URL for a medical referral attachment.
 */
export async function getMedicalAttachmentUrl(
  referralId: string,
  storagePath: string,
): Promise<string> {
  const { data, error } =
    await supabase.functions.invoke<EdgeResponse>("storage-authorize", {
      body: {
        action: "sign_download",
        referralId,
        storagePath,
      },
    });

  if (error) {
    const errorBody = await readEdgeFunctionError(error);
    throw new Error(
      errorBody.code || "Não foi possível autorizar o download.",
    );
  }

  if (!data?.success || !data.downloadUrl) {
    throw new Error(data?.code || "Download não autorizado.");
  }

  return data.downloadUrl;
}

/**
 * Lists attachment metadata through the server-side authorization boundary.
 * Direct table access is intentionally not granted to authenticated clients.
 */
export async function listReferralAttachments(referralId: string) {
  const { data, error } = await supabase.rpc(
    "list_medical_referral_attachments",
    { p_referral_id: referralId },
  );

  if (error) throw new Error("Não foi possível listar os anexos.");
  return data || [];
}

export type AttachmentInfo = Awaited<
  ReturnType<typeof listReferralAttachments>
>[number];
