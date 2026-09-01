import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import {
  corsHeaders,
  jsonResponse,
  readJsonBody,
  requestId,
} from "shared/http.ts";

type StorageAction =
  | {
      action: "sign_upload";
      referralId?: string;
      fileName?: string;
      mimeType?: string;
      byteSize?: number;
    }
  | {
      action: "sign_download";
      referralId?: string;
      storagePath?: string;
    };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_MIMES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const MAX_FILE_SIZE = 10_485_760; // 10 MB
const SIGNED_URL_EXPIRY = 3600; // 1 hour

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_secret:${name}`);
  return value;
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const currentRequestId = requestId(request);

  if (!cors) {
    return jsonResponse(
      { success: false, code: "ORIGIN_NOT_ALLOWED", requestId: currentRequestId },
      403,
    );
  }
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors });
  }
  if (request.method !== "POST") {
    return jsonResponse(
      { success: false, code: "METHOD_NOT_ALLOWED", requestId: currentRequestId },
      405,
      cors,
    );
  }

  try {
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ")) {
      return jsonResponse(
        { success: false, code: "UNAUTHORIZED", requestId: currentRequestId },
        401,
        cors,
      );
    }

    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const anonKey = requiredEnv("SUPABASE_ANON_KEY");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const body = await readJsonBody<StorageAction>(request);

    // User client
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Admin client for privileged checks
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify JWT
    const { data: authData, error: authError } = await userClient.auth.getUser();
    if (authError || !authData.user) {
      return jsonResponse(
        { success: false, code: "UNAUTHORIZED", requestId: currentRequestId },
        401,
        cors,
      );
    }

    // ── SIGN UPLOAD ───────────────────────────────────────────────────────
    if (body.action === "sign_upload") {
      const referralId = String(body.referralId || "").trim();
      const fileName = String(body.fileName || "").trim();
      const mimeType = String(body.mimeType || "").trim();
      const byteSize = Number(body.byteSize || 0);

      if (!UUID_PATTERN.test(referralId)) {
        return jsonResponse(
          { success: false, code: "INVALID_REFERRAL_ID", requestId: currentRequestId },
          400,
          cors,
        );
      }

      if (!ALLOWED_MIMES.has(mimeType)) {
        return jsonResponse(
          {
            success: false,
            code: "INVALID_MIME_TYPE",
            message: `Allowed: ${[...ALLOWED_MIMES].join(", ")}`,
            requestId: currentRequestId,
          },
          400,
          cors,
        );
      }

      if (byteSize <= 0 || byteSize > MAX_FILE_SIZE) {
        return jsonResponse(
          {
            success: false,
            code: "INVALID_FILE_SIZE",
            message: `Max size: ${MAX_FILE_SIZE} bytes`,
            requestId: currentRequestId,
          },
          400,
          cors,
        );
      }

      if (fileName.length < 1 || fileName.length > 180) {
        return jsonResponse(
          { success: false, code: "INVALID_FILE_NAME", requestId: currentRequestId },
          400,
          cors,
        );
      }

      // Verify referral access
      const { data: accessCheck, error: accessError } = await admin.rpc(
        "can_access_medical_referral",
        { p_referral_id: referralId },
      );

      if (accessError || !accessCheck) {
        return jsonResponse(
          {
            success: false,
            code: "REFERRAL_ACCESS_DENIED",
            requestId: currentRequestId,
          },
          403,
          cors,
        );
      }

      // Determine actor side
      const { data: side, error: sideError } = await admin.rpc(
        "medical_referral_actor_side",
        { p_referral_id: referralId },
      );

      if (sideError || !side) {
        return jsonResponse(
          { success: false, code: "ACTOR_SIDE_FAILED", requestId: currentRequestId },
          400,
          cors,
        );
      }

      // Generate storage path: referral_id/sender_uuid/file_uuid.ext
      const fileExt = mimeType === "application/pdf"
        ? "pdf"
        : mimeType === "image/png"
        ? "png"
        : "jpg";
      const fileId = crypto.randomUUID();
      const storagePath = `${referralId}/${authData.user.id}/${fileId}.${fileExt}`;

      // Create the signed upload URL
      const { data: signedUrl, error: signError } = await admin.storage
        .from("medical-referral-attachments")
        .createSignedUploadUrl(storagePath);

      if (signError || !signedUrl) {
        return jsonResponse(
          {
            success: false,
            code: "SIGN_UPLOAD_FAILED",
            message: signError?.message,
            requestId: currentRequestId,
          },
          500,
          cors,
        );
      }

      // Pre-register the attachment record
      const { error: insertError } = await admin
        .from("medical_referral_attachments")
        .insert({
          referral_id: referralId,
          sender_id: authData.user.id,
          sender_side: side,
          storage_path: storagePath,
          original_name: fileName,
          mime_type: mimeType,
          byte_size: byteSize,
        });

      if (insertError) {
        return jsonResponse(
          {
            success: false,
            code: "ATTACHMENT_REGISTER_FAILED",
            message: insertError.message,
            requestId: currentRequestId,
          },
          400,
          cors,
        );
      }

      return jsonResponse(
        {
          success: true,
          code: "UPLOAD_AUTHORIZED",
          requestId: currentRequestId,
          uploadUrl: signedUrl.signedUrl,
          storagePath,
          fileId,
        },
        200,
        cors,
      );
    }

    // ── SIGN DOWNLOAD ─────────────────────────────────────────────────────
    if (body.action === "sign_download") {
      const referralId = String(body.referralId || "").trim();
      const storagePath = String(body.storagePath || "").trim();

      if (!UUID_PATTERN.test(referralId)) {
        return jsonResponse(
          { success: false, code: "INVALID_REFERRAL_ID", requestId: currentRequestId },
          400,
          cors,
        );
      }

      // Verify the path belongs to this referral
      if (!storagePath.startsWith(referralId + "/")) {
        return jsonResponse(
          {
            success: false,
            code: "PATH_MISMATCH",
            requestId: currentRequestId,
          },
          403,
          cors,
        );
      }

      // Verify access
      const { data: accessCheck } = await admin.rpc(
        "can_access_medical_referral",
        { p_referral_id: referralId },
      );

      if (!accessCheck) {
        return jsonResponse(
          {
            success: false,
            code: "REFERRAL_ACCESS_DENIED",
            requestId: currentRequestId,
          },
          403,
          cors,
        );
      }

      // Verify the attachment exists
      const { data: attachment } = await admin
        .from("medical_referral_attachments")
        .select("id")
        .eq("referral_id", referralId)
        .eq("storage_path", storagePath)
        .maybeSingle();

      if (!attachment) {
        return jsonResponse(
          {
            success: false,
            code: "ATTACHMENT_NOT_FOUND",
            requestId: currentRequestId,
          },
          404,
          cors,
        );
      }

      // Create signed download URL
      const { data: signedUrl, error: signError } = await admin.storage
        .from("medical-referral-attachments")
        .createSignedUrl(storagePath, SIGNED_URL_EXPIRY);

      if (signError || !signedUrl) {
        return jsonResponse(
          {
            success: false,
            code: "SIGN_DOWNLOAD_FAILED",
            message: signError?.message,
            requestId: currentRequestId,
          },
          500,
          cors,
        );
      }

      return jsonResponse(
        {
          success: true,
          code: "DOWNLOAD_AUTHORIZED",
          requestId: currentRequestId,
          downloadUrl: signedUrl.signedUrl,
          expiresAt: new Date(Date.now() + SIGNED_URL_EXPIRY * 1000).toISOString(),
        },
        200,
        cors,
      );
    }

    return jsonResponse(
      { success: false, code: "INVALID_ACTION", requestId: currentRequestId },
      400,
      cors,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      JSON.stringify({
        event: "storage_authorize_failed",
        requestId: currentRequestId,
        error: message.split(":")[0],
      }),
    );
    return jsonResponse(
      {
        success: false,
        code: "INTERNAL_ERROR",
        requestId: currentRequestId,
      },
      500,
      cors,
    );
  }
});
