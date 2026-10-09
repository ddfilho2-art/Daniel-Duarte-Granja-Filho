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
      action: "end_contract";
      tenantId?: string;
    }
  | {
      action: "list_tenants";
    }
  | {
      action: "tenant_usage";
    }
  | {
      action: "get_tenant";
      tenantId?: string;
    }
  | {
      action: "list_branding_versions";
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
          "id, kind, cnpj, legal_name, display_name, slug, status, created_at, updated_at, contract_ended_at",
        )
        .order("created_at", { ascending: false });

      if (error) throw error;

      return jsonResponse(
        { success: true, tenants: tenants || [], requestId: currentRequestId },
        200,
        cors,
      );
    }

    // ── TENANT RESOURCE USAGE ─────────────────────────────────────────────
    if (body.action === "tenant_usage") {
      const { data: tenants, error: tenantsError } = await admin
        .from("tenants")
        .select("id, display_name, status")
        .order("display_name", { ascending: true });
      if (tenantsError) throw tenantsError;

      const tenantUsage = await Promise.all((tenants || []).map(async (tenant) => {
        const countForTenant = async (table: string) => {
          const { count, error } = await admin
            .from(table)
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tenant.id);
          if (error) throw error;
          return count || 0;
        };

        const [memberships, vacancies, candidates, applications, aiRequests, auditEvents] =
          await Promise.all([
            countForTenant("tenant_memberships"),
            countForTenant("vagas"),
            countForTenant("candidatos"),
            countForTenant("candidaturas"),
            countForTenant("ai_analysis_requests"),
            countForTenant("tenant_audit_logs"),
          ]);

        // Paginate Storage metadata instead of silently capping attribution at the first 1,000 entries.
        // Count only actual objects (not folder placeholders); this remains partial attribution by design.
        const storagePageSize = 1000;
        let brandingFileCount = 0;
        let brandingBytes = 0;
        for (let offset = 0; ; offset += storagePageSize) {
          const { data: files, error: brandingFilesError } = await admin.storage
            .from("tenant-branding")
            .list(tenant.id, { limit: storagePageSize, offset });
          if (brandingFilesError) throw brandingFilesError;

          const objects = (files || []).filter((file) => file.id || file.metadata);
          brandingFileCount += objects.length;
          brandingBytes += objects.reduce((sum, file) => {
            const size = Number(file.metadata?.size);
            return sum + (Number.isFinite(size) && size > 0 ? size : 0);
          }, 0);

          if (!files || files.length < storagePageSize) break;
        }

        const { data: operations, error: operationsError } = await admin
          .from("tenant_admin_operations")
          .select("id")
          .eq("tenant_id", tenant.id);
        if (operationsError) throw operationsError;

        let adminAttachmentBytes = 0;
        if ((operations || []).length > 0) {
          const { data: attachments, error: attachmentsError } = await admin
            .from("tenant_admin_operation_attachments")
            .select("size_bytes")
            .in("operation_id", operations!.map((operation) => operation.id));
          if (attachmentsError) throw attachmentsError;
          adminAttachmentBytes = (attachments || []).reduce((sum, attachment) => {
            const size = Number(attachment.size_bytes);
            return sum + (Number.isFinite(size) && size > 0 ? size : 0);
          }, 0);
        }

        return {
          tenant_id: tenant.id,
          display_name: tenant.display_name,
          status: tenant.status,
          memberships,
          vacancies,
          candidates,
          applications,
          ai_requests: aiRequests,
          audit_events: auditEvents,
          branding_file_count: brandingFileCount,
          branding_bytes: brandingBytes,
          admin_attachment_bytes: adminAttachmentBytes,
          attributed_storage_bytes: brandingBytes + adminAttachmentBytes,
          storage_scope: "partial",
        };
      }));

      return jsonResponse(
        { success: true, code: "TENANT_USAGE_LISTED", tenantUsage, requestId: currentRequestId },
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
          "id, kind, cnpj, legal_name, display_name, slug, status, metadata, published_branding_id, created_at, updated_at, contract_ended_at, archived_at",
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

    // ── LIST BRANDING VERSIONS ────────────────────────────────────────────
    if (body.action === "list_branding_versions") {
      const tenantId = String(body.tenantId || "").trim();
      if (!UUID_PATTERN.test(tenantId)) {
        return jsonResponse(
          { success: false, code: "INVALID_TENANT_ID", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const { data: versions, error } = await admin
        .from("tenant_branding_versions")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("version", { ascending: false });

      if (error) throw error;

      // auth.users não é consultável diretamente pelo frontend. Resolver os autores
      // no servidor evita expor UUIDs como se fossem nomes na tela de auditoria.
      const userIds = [...new Set((versions || [])
        .flatMap((version) => [version.created_by, version.published_by])
        .filter((id): id is string => typeof id === "string" && UUID_PATTERN.test(id)))];

      const identities = await Promise.all(userIds.map(async (userId) => {
        const { data, error: userError } = await admin.auth.admin.getUserById(userId);
        if (userError || !data.user) return [userId, { name: null, email: null }] as const;
        const metadata = data.user.user_metadata || {};
        const name = [metadata.full_name, metadata.name, metadata.display_name, metadata.nome]
          .find((value) => typeof value === "string" && value.trim().length > 0);
        return [userId, {
          name: typeof name === "string" ? name.trim() : null,
          email: data.user.email || null,
        }] as const;
      }));
      const identityById = new Map(identities);

      const enrichedVersions = (versions || []).map((version) => {
        const creator = typeof version.created_by === "string"
          ? identityById.get(version.created_by)
          : undefined;
        const publisher = typeof version.published_by === "string"
          ? identityById.get(version.published_by)
          : undefined;
        return {
          ...version,
          created_by_name: creator?.name || null,
          created_by_email: creator?.email || null,
          published_by_name: publisher?.name || null,
          published_by_email: publisher?.email || null,
        };
      });

      return jsonResponse(
        { success: true, code: "BRANDING_VERSIONS_LISTED", versions: enrichedVersions, requestId: currentRequestId },
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

      const { data: currentTenant, error: currentTenantError } = await admin
        .from("tenants")
        .select("status")
        .eq("id", tenantId)
        .maybeSingle();

      if (currentTenantError) throw currentTenantError;
      if (!currentTenant) {
        return jsonResponse(
          { success: false, code: "TENANT_NOT_FOUND", requestId: currentRequestId },
          404,
          cors,
        );
      }
      if (currentTenant.status === "archived") {
        return jsonResponse(
          { success: false, code: "CONTRACT_ENDED", message: "Contract already ended", requestId: currentRequestId },
          409,
          cors,
        );
      }

      const { error } = await admin
        .from("tenants")
        .update({
          status: "suspended",
          suspended_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
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

      const { data: currentTenant, error: currentTenantError } = await admin
        .from("tenants")
        .select("status")
        .eq("id", tenantId)
        .maybeSingle();

      if (currentTenantError) throw currentTenantError;
      if (!currentTenant) {
        return jsonResponse(
          { success: false, code: "TENANT_NOT_FOUND", requestId: currentRequestId },
          404,
          cors,
        );
      }
      if (currentTenant.status === "archived") {
        return jsonResponse(
          { success: false, code: "CONTRACT_ENDED_CANNOT_ACTIVATE", message: "A contract-ended company cannot be reactivated.", requestId: currentRequestId },
          409,
          cors,
        );
      }

      const { error } = await admin
        .from("tenants")
        .update({
          status: "active",
          suspended_at: null,
          contract_ended_at: null,
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

    // ── END CONTRACT ───────────────────────────────────────────────────────
    if (body.action === "end_contract") {
      const tenantId = String(body.tenantId || "").trim();
      if (!UUID_PATTERN.test(tenantId)) {
        return jsonResponse(
          { success: false, code: "INVALID_TENANT_ID", requestId: currentRequestId },
          400,
          cors,
        );
      }

      const endedAt = new Date().toISOString();
      const { data: currentTenant, error: currentTenantError } = await admin
        .from("tenants")
        .select("id, status")
        .eq("id", tenantId)
        .maybeSingle();

      if (currentTenantError) throw currentTenantError;
      if (!currentTenant) {
        return jsonResponse(
          { success: false, code: "TENANT_NOT_FOUND", requestId: currentRequestId },
          404,
          cors,
        );
      }

      if (currentTenant.status !== "archived") {
        const { error } = await admin
          .from("tenants")
          .update({
            status: "archived",
            contract_ended_at: endedAt,
            archived_at: endedAt,
            suspended_at: null,
            updated_at: endedAt,
          })
          .eq("id", tenantId);

        if (error) throw error;

        await admin.from("tenant_audit_logs").insert({
          tenant_id: tenantId,
          actor_id: authData.user.id,
          action: "platform.tenant.contract_ended",
          resource_type: "tenant",
          resource_id: tenantId,
          details: { contract_ended_at: endedAt },
        });
      }

      return jsonResponse(
        { success: true, code: "TENANT_CONTRACT_ENDED", requestId: currentRequestId },
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
      const { data, error } = await userClient.rpc("create_tenant_branding_draft", {
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
      const { data, error } = await userClient.rpc("publish_tenant_branding", {
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
      const { data: result, error: rpcError } = await admin.rpc(
        "provision_tenant",
        {
          p_actor_id: authData.user.id,
          p_kind: kind,
          p_cnpj: cnpj,
          p_legal_name: legalName,
          p_display_name: displayName,
          p_slug: slug,
        },
      );

      if (rpcError) {
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
          code: "TENANT_CREATED",
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
    const errorRecord = error && typeof error === "object"
      ? error as Record<string, unknown>
      : null;
    const message = error instanceof Error
      ? error.message
      : String(errorRecord?.message || errorRecord?.details || errorRecord?.hint || error);
    const code = typeof errorRecord?.code === "string" ? errorRecord.code : undefined;
    console.error(JSON.stringify({
      event: "tenant_provisioning_failed",
      requestId: currentRequestId,
      code,
      error: message.slice(0, 300),
    }));
    const expectedClientError = code === "22023" || code === "P0002" || code === "42501";
    return jsonResponse(
      {
        success: false,
        code: expectedClientError ? "BRANDING_OPERATION_REJECTED" : "INTERNAL_ERROR",
        message: expectedClientError ? message : "A operação falhou no servidor. Informe o código de atendimento.",
        requestId: currentRequestId,
      },
      expectedClientError ? (code === "42501" ? 403 : 400) : 500,
      cors,
    );
  }
});
