import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { corsHeaders, jsonResponse, readJsonBody, requestId } from "shared/http.ts";

type Body =
  | { action: "sign_upload"; conversationId?: string; fileName?: string; mimeType?: string; byteSize?: number }
  | { action: "sign_download"; conversationId?: string; storagePath?: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MIME = new Set(["application/pdf", "image/png", "image/jpeg"]);
const MAX = 10_485_760;
const EXPIRY_SECONDS = 900;

function env(name: string) {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_secret:${name}`);
  return value;
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const id = requestId(request);
  if (!cors) return jsonResponse({ success: false, code: "ORIGIN_NOT_ALLOWED", requestId: id }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED", requestId: id }, 405, cors);

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse({ success: false, code: "UNAUTHORIZED", requestId: id }, 401, cors);
    }
    const url = env("SUPABASE_URL");
    const anon = env("SUPABASE_ANON_KEY");
    const service = env("SUPABASE_SERVICE_ROLE_KEY");
    const userClient = createClient(url, anon, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const admin = createClient(url, service, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: auth, error: authError } = await userClient.auth.getUser();
    if (authError || !auth.user) return jsonResponse({ success: false, code: "UNAUTHORIZED", requestId: id }, 401, cors);

    const body = await readJsonBody<Body>(request);
    const conversationId = String(body.conversationId || "").trim();
    if (!UUID.test(conversationId)) return jsonResponse({ success: false, code: "INVALID_CONVERSATION_ID", requestId: id }, 400, cors);

    const { data: allowed, error: accessError } = await userClient.rpc(
      "can_access_tenant_clinic_conversation", { p_conversation_id: conversationId },
    );
    if (accessError || !allowed) return jsonResponse({ success: false, code: "CONVERSATION_ACCESS_DENIED", requestId: id }, 403, cors);

    const { data: conversation, error: conversationError } = await admin
      .from("tenant_clinic_conversations")
      .select("id,status,clinic_tenant_id,medical_referral_id")
      .eq("id", conversationId)
      .maybeSingle();
    if (conversationError || !conversation) return jsonResponse({ success: false, code: "CONVERSATION_NOT_FOUND", requestId: id }, 404, cors);
    if (conversation.status !== "open") return jsonResponse({ success: false, code: "CONVERSATION_CLOSED", requestId: id }, 409, cors);
    if (!conversation.medical_referral_id) {
      return jsonResponse({ success: false, code: "MEDICAL_REFERRAL_REQUIRED_FOR_ATTACHMENT", requestId: id }, 400, cors);
    }

    const { data: isClinic, error: sideError } = await userClient.rpc("is_active_clinic_member", { p_clinic_tenant_id: conversation.clinic_tenant_id });
    if (sideError || typeof isClinic !== "boolean") {
      return jsonResponse({ success: false, code: "ACTOR_SIDE_FAILED", requestId: id }, 403, cors);
    }
    const senderSide = isClinic ? "clinic" : "employer";

    if (body.action === "sign_upload") {
      const fileName = String(body.fileName || "").trim();
      const mimeType = String(body.mimeType || "").trim();
      const byteSize = Number(body.byteSize || 0);
      if (!MIME.has(mimeType)) return jsonResponse({ success: false, code: "INVALID_MIME_TYPE", requestId: id }, 400, cors);
      if (!fileName || fileName.length > 180) return jsonResponse({ success: false, code: "INVALID_FILE_NAME", requestId: id }, 400, cors);
      if (!Number.isInteger(byteSize) || byteSize < 1 || byteSize > MAX) return jsonResponse({ success: false, code: "INVALID_FILE_SIZE", requestId: id }, 400, cors);

      const ext = mimeType === "application/pdf" ? "pdf" : mimeType === "image/png" ? "png" : "jpg";
      const path = `${conversationId}/${auth.user.id}/${crypto.randomUUID()}.${ext}`;
      const { data: signed, error: signedError } = await admin.storage
        .from("tenant-clinic-chat-attachments").createSignedUploadUrl(path);
      if (signedError || !signed) return jsonResponse({ success: false, code: "SIGN_UPLOAD_FAILED", requestId: id }, 500, cors);

      const { error: insertError } = await admin.from("tenant_clinic_attachments").insert({
        conversation_id: conversationId, sender_id: auth.user.id, sender_side: senderSide,
        storage_path: path, original_name: fileName, mime_type: mimeType, byte_size: byteSize,
      });
      if (insertError) return jsonResponse({ success: false, code: "ATTACHMENT_REGISTER_FAILED", requestId: id }, 500, cors);
      return jsonResponse({ success: true, code: "UPLOAD_AUTHORIZED", requestId: id, uploadUrl: signed.signedUrl, uploadToken: signed.token, storagePath: path }, 200, cors);
    }

    if (body.action === "sign_download") {
      const path = String(body.storagePath || "").trim();
      if (!path.startsWith(conversationId + "/")) return jsonResponse({ success: false, code: "PATH_MISMATCH", requestId: id }, 403, cors);
      const { data: attachment } = await admin.from("tenant_clinic_attachments")
        .select("id").eq("conversation_id", conversationId).eq("storage_path", path).maybeSingle();
      if (!attachment) return jsonResponse({ success: false, code: "ATTACHMENT_NOT_FOUND", requestId: id }, 404, cors);
      const { data: signed, error: signedError } = await admin.storage
        .from("tenant-clinic-chat-attachments").createSignedUrl(path, EXPIRY_SECONDS);
      if (signedError || !signed) return jsonResponse({ success: false, code: "SIGN_DOWNLOAD_FAILED", requestId: id }, 500, cors);
      return jsonResponse({ success: true, code: "DOWNLOAD_AUTHORIZED", requestId: id, downloadUrl: signed.signedUrl,
        expiresAt: new Date(Date.now() + EXPIRY_SECONDS * 1000).toISOString() }, 200, cors);
    }

    return jsonResponse({ success: false, code: "INVALID_ACTION", requestId: id }, 400, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(JSON.stringify({ event: "tenant_clinic_storage_failed", requestId: id, error: message.split(":")[0] }));
    return jsonResponse({ success: false, code: "INTERNAL_ERROR", requestId: id }, 500, cors);
  }
});
