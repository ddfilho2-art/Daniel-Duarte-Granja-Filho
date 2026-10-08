import { createClient } from "npm:@supabase/supabase-js@2.101.1";
import {
  corsHeaders,
  jsonResponse,
  readJsonBody,
  requestId,
} from "./_shared/http.ts";

type ProvisionAction =
  | {
      action: "provision";
      kind?: string;
      cnpj?: string;
      legalName?: string;
      displayName?: string;
      slug?: string;
      adminEmail?: string;
      adminPassword?: string;
    }
  | {
      action: "suspend";
      tenantId?: string;
    }
  | {
      action: "activate";
      tenantId?: string;
    }
  | {
      action: "list_tenants";
    }
  | {
      action: "get_tenant";
      tenantId?: string;
    }
  | {
      action: "create_branding_draft";
      tenantId?: string;
      theme?: Record<string, unknown>;
      reason?: string;
    }
  | {
      action: "publish_branding";
      tenantId?: string;
      brandingId?: string;
      reason?: string;
    };

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requiredEnv(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`missing_secret:${name}`);
  return value;
}

function validPassword(value: string): boolean {
  return (
    value.length >= 8 &&
    value.length <= 128 &&
    /[a-z]/.test(value) &&
    /[A-Z]/.test(value) &&
    /\d/.test(value)
  );
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
    const body = await readJsonBody<ProvisionAction>(request);

    // User client with JWT for auth verification
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Admin client for privileged operations
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

    // Check platform_master_admin role
    const { data: roleCheck } = await admin
      .from("platform_user_roles")
      .select("id")
      .eq("user_id", authData.user.id)
      .eq("role", "platform_master_admin")
      .eq("active", true)
      .is("revoked_at", null)
      .maybeSingle();

    if (!roleCheck) {
      return jsonResponse(
        {
          success: false,
          code: "FORBIDDEN",
          message: "platform_master_admin_required",
          requestId: currentRequestId,
        },
        403,
        cors,
      );
    }

    // ── LIST TENANTS ──────────────────────────────────────────────────────
    if (body.action === "list_tenants") {
      const { data: tenants, error } = await admin
        .from("tenants")
        .select(
          "id, kind, cnpj, legal_name, display_name, slug, status, created_at, updated_at",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return jsonResponse(
        { success: true, tenants: tenants || [], requestId: currentRequestId },
        200,
        cors,
      );
    }

    // ── GET TENANT ────────────────────────────────────────────────────────
    if (body.action === "get_tenant") {
      const tenantId = String(body.tenantId || "").trim();
      if (!UUID_PATTERN.test(tenantId)) {
        return jsonResponse(
          { success: false, code: "INVALID_TENANT_ID", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const { data: tenant, error } = await admin
        .from("tenants")
        .select(
          "id, kind, cnpj, legal_name, display_name, slug, status, metadata, published_branding_id, created_at, updated_at",
        )
        .eq("id", tenantId)
        .maybeSingle();

      if (error) throw error;
      if (!tenant) {
        return jsonResponse(
          { success: false, code: "TENANT_NOT_FOUND", requestId: currentRequestId },
          404,
          cors,
        );
      }

      // Get memberships count
      const { count: memberCount } = await admin
        .from("tenant_memberships")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId);

      return jsonResponse(
        {
          success: true,
          tenant: { ...tenant, memberCount: memberCount || 0 },
          requestId: currentRequestId,
        },
        200,
        cors,
      );
    }

    // ── SUSPEND TENANT ────────────────────────────────────────────────────
    if (body.action === "suspend") {
      const tenantId = String(body.tenantId || "").trim();
      if (!UUID_PATTERN.test(tenantId)) {
        return jsonResponse(
          { success: false, code: "INVALID_TENANT_ID", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const { error } = await admin
        .from("tenants")
        .update({ status: "suspended", suspended_at: new Date().toISOString() })
        .eq("id", tenantId);

      if (error) throw error;

      // Audit
      await admin.from("tenant_audit_logs").insert({
        tenant_id: tenantId,
        actor_id: authData.user.id,
        action: "platform.tenant.suspended",
        resource_type: "tenant",
        resource_id: tenantId,
        details: {},
      });

      return jsonResponse(
        { success: true, code: "TENANT_SUSPENDED", requestId: currentRequestId },
        200,
        cors,
      );
    }

    // ── ACTIVATE TENANT ───────────────────────────────────────────────────
    if (body.action === "activate") {
      const tenantId = String(body.tenantId || "").trim();
      if (!UUID_PATTERN.test(tenantId)) {
        return jsonResponse(
          { success: false, code: "INVALID_TENANT_ID", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const { error } = await admin
        .from("tenants")
        .update({
          status: "active",
          suspended_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", tenantId);

      if (error) throw error;

      await admin.from("tenant_audit_logs").insert({
        tenant_id: tenantId,
        actor_id: authData.user.id,
        action: "platform.tenant.activated",
        resource_type: "tenant",
        resource_id: tenantId,
        details: {},
      });

      return jsonResponse(
        { success: true, code: "TENANT_ACTIVATED", requestId: currentRequestId },
        200,
        cors,
      );
    }

    // ── PROVISION TENANT ──────────────────────────────────────────────────
    // ── CREATE BRANDING DRAFT ─────────────────────────────────────────────
    if (body.action === "create_branding_draft") {
      const tenantId = String(body.tenantId || "").trim();
      const reason = String(body.reason || "").trim();
      if (!UUID_PATTERN.test(tenantId) || !reason || reason.length > 500) {
        return jsonResponse(
          { success: false, code: "INVALID_INPUT", requestId: currentRequestId },
          400,
          cors,
        );
      }
      const { data, error } = await admin.rpc("create_tenant_branding_draft", {
        p_actor_id: authData.user.id,
        p_tenant_id: tenantId,
        p_theme: body.theme || {},
        p_reason: reason,
      });
      if (error) throw error;
      return jsonResponse(
        { success: true, code: "BRANDING_DRAFT_CREATED", requestId: currentRequestId, result: data },
        200,
        cors,
      );
    }

    // ── PUBLISH BRANDING ──────────────────────────────────────────────────
    if (body.action === "publish_branding") {
      const tenantId = String(body.tenantId || "").trim();
      const brandingId = String(body.brandingId || "").trim();
      const reason = String(body.reason || "").trim();
      if (!UUID_PATTERN.test(tenantId) || !UUID_PATTERN.test(brandingId) || !reason || reason.length > 500) {
        return jsonResponse(
          { success: false, code: "INVALID_INPUT", requestId: currentRequestId },
          400,
          cors,
        );
      }
      const { data, error } = await admin.rpc("publish_tenant_branding", {
        p_actor_id: authData.user.id,
        p_tenant_id: tenantId,
        p_branding_id: brandingId,
        p_reason: reason,
      });
      if (error) throw error;
      return jsonResponse(
        { success: true, code: "BRANDING_PUBLISHED", requestId: currentRequestId, result: data },
        200,
        cors,
      );
    }

    if (body.action === "provision") {
      const kind = body.kind === "occupational_health_provider"
        ? "occupational_health_provider"
        : "employer";
      const cnpj = String(body.cnpj || "").trim();
      const legalName = String(body.legalName || "").trim();
      const displayName = String(body.displayName || "").trim();
      const slug = String(body.slug || "").trim();
      const adminEmail = String(body.adminEmail || "").trim().toLowerCase();
      const adminPassword = String(body.adminPassword || "");

      // Validation
      if (
        legalName.length < 2 ||
        legalName.length > 200 ||
        displayName.length < 2 ||
        displayName.length > 160 ||
        slug.length < 3 ||
        slug.length > 63 ||
        !EMAIL_PATTERN.test(adminEmail) ||
        !validPassword(adminPassword)
      ) {
        return jsonResponse(
          {
            success: false,
            code: "INVALID_INPUT",
            message: "Validation failed for one or more fields",
            requestId: currentRequestId,
          },
          400,
          cors,
        );
      }

      // Create the admin user via Supabase Auth
      const { data: newUser, error: createError } =
        await admin.auth.admin.createUser({
          email: adminEmail,
          password: adminPassword,
          email_confirm: true,
          user_metadata: {
            nome: displayName + " Admin",
            perfil: "Admin",
          },
        });

      if (createError || !newUser.user) {
        return jsonResponse(
          {
            success: false,
            code: "AUTH_CREATE_FAILED",
            message: createError?.message || "Failed to create admin user",
            requestId: currentRequestId,
          },
          400,
          cors,
        );
      }

      const adminUserId = newUser.user.id;

      // Create the legacy users row
      const { error: profileError } = await admin.from("users").upsert(
        {
          id: adminUserId,
          uid: adminUserId,
          nome: displayName + " Admin",
          email: adminEmail,
          login: adminEmail.split("@")[0],
          login_lower: adminEmail.split("@")[0].toLowerCase(),
          perfil: "Admin",
          status: "Ativo",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" },
      );

      if (profileError) {
        await admin.auth.admin.deleteUser(adminUserId).catch(() => undefined);
        throw profileError;
      }

      // Call provision_tenant RPC
      const { data: result, error: rpcError } = await admin.rpc(
        "provision_tenant",
        {
          p_actor_id: authData.user.id,
          p_kind: kind,
          p_cnpj: cnpj,
          p_legal_name: legalName,
          p_display_name: displayName,
          p_slug: slug,
          p_admin_user_id: adminUserId,
        },
      );

      if (rpcError) {
        await admin.auth.admin.deleteUser(adminUserId).catch(() => undefined);
        return jsonResponse(
          {
            success: false,
            code: "PROVISION_FAILED",
            message: rpcError.message,
            requestId: currentRequestId,
          },
          400,
          cors,
        );
      }

      return jsonResponse(
        {
          success: true,
          code: "TENANT_PROVISIONED",
          requestId: currentRequestId,
          result,
        },
        201,
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
        event: "tenant_provisioning_failed",
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
