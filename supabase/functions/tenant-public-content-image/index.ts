import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import { corsHeaders, jsonResponse, readJsonBody, requestId } from "shared/http.ts";

interface ImageRequest { tenantSlug?: string; path?: string; }
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;
const PATH_PATTERN =
  /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/site-content\/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.(png|webp)$/;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_secret:${name}`);
  return value;
}

Deno.serve(async (request) => {
  const cors = corsHeaders(request);
  const currentRequestId = requestId(request);
  if (!cors) return jsonResponse({ success: false, code: "ORIGIN_NOT_ALLOWED", requestId: currentRequestId }, 403);
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (request.method !== "POST") return jsonResponse({ success: false, code: "METHOD_NOT_ALLOWED", requestId: currentRequestId }, 405, cors);

  try {
    const body = await readJsonBody<ImageRequest>(request, 4096);
    const tenantSlug = String(body.tenantSlug || "").trim().toLowerCase();
    const path = String(body.path || "").trim().toLowerCase();
    const match = PATH_PATTERN.exec(path);
    if (!SLUG_PATTERN.test(tenantSlug) || !match || path.length > 180) {
      return jsonResponse({ success: false, code: "IMAGE_NOT_PUBLISHED", requestId: currentRequestId }, 404, cors);
    }

    const admin = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: tenant, error: tenantError } = await admin
      .from("tenants").select("id, kind, status, slug").eq("slug", tenantSlug).maybeSingle();
    if (tenantError) throw new Error("tenant_lookup_failed");
    if (!tenant || tenant.slug !== tenantSlug || tenant.kind !== "employer" || tenant.status !== "active" || tenant.id !== match[1]) {
      return jsonResponse({ success: false, code: "IMAGE_NOT_PUBLISHED", requestId: currentRequestId }, 404, cors);
    }

    const { data: published, error: contentError } = await admin
      .from("tenant_public_content_versions").select("about_content")
      .eq("tenant_id", tenant.id).eq("status", "published")
      .order("version", { ascending: false }).limit(1).maybeSingle();
    if (contentError) throw new Error("published_content_lookup_failed");
    const about = published?.about_content;
    const sections = about && typeof about === "object" && Array.isArray(about.sections) ? about.sections : [];
    const referenced = sections.some((section: unknown) =>
      section !== null && typeof section === "object" && "imagePath" in section && section.imagePath === path
    );
    if (!referenced) {
      return jsonResponse({ success: false, code: "IMAGE_NOT_PUBLISHED", requestId: currentRequestId }, 404, cors);
    }

    const { data: signed, error: signedError } = await admin.storage.from("tenant-public-content").createSignedUrl(path, 900);
    if (signedError || !signed?.signedUrl) throw new Error("signed_url_creation_failed");
    return jsonResponse({ success: true, url: signed.signedUrl, expiresInSeconds: 900, requestId: currentRequestId }, 200, cors);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    console.error(JSON.stringify({ event: "tenant_public_content_image_failed", requestId: currentRequestId, code: message.slice(0, 80) }));
    const status = message === "invalid_json" || message === "unsupported_media_type" ? 400 : message === "payload_too_large" ? 413 : 500;
    return jsonResponse({ success: false, code: status === 500 ? "INTERNAL_ERROR" : "INVALID_REQUEST", requestId: currentRequestId }, status, cors);
  }
});
