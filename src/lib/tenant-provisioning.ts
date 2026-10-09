import { supabase } from "./supabase";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface TenantListItem {
  id: string;
  kind: string;
  cnpj: string;
  legal_name: string;
  display_name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
  contract_ended_at?: string | null;
  archived_at?: string | null;
}

export interface TenantDetail extends TenantListItem {
  metadata: Record<string, unknown>;
  published_branding_id: string | null;
  memberCount: number;
}

export interface ProvisionPayload {
  kind?: "employer" | "occupational_health_provider";
  cnpj: string;
  legalName: string;
  displayName: string;
  slug: string;
}

export interface BrandingDraftPayload {
  display_name?: string;
  sidebar_background?: string;
  sidebar_text?: string;
  sidebar_active?: string;
  sidebar_hover?: string;
  home_background?: string;
  hero_background?: string;
  hero_text?: string;
  primary_action?: string;
  accent?: string;
  primary_color?: string;
  secondary_color?: string;
  link_color?: string;
  focus_ring_color?: string;
  logo_primary_path?: string;
}

interface EdgeResponse {
  success: boolean;
  code: string;
  message?: string;
  requestId: string;
  result?: Record<string, unknown>;
  tenants?: TenantListItem[];
  tenant?: TenantDetail;
  versions?: Record<string, unknown>[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

async function callEdge(
  action: string,
  body: Record<string, unknown>,
): Promise<EdgeResponse> {
  const { data, error } = await supabase.functions.invoke<EdgeResponse>(
    "tenant-provisioning",
    { body: { action, ...body } },
  );

  if (error) {
    const context = (error as unknown as { context?: Response }).context;
    if (context) {
      try {
        const payload = await context.clone().json();
        throw new Error(
          String(payload?.message || payload?.code || error.message || "Edge function error"),
        );
      } catch (contextError) {
        if (contextError instanceof Error && contextError.message !== error.message) {
          throw contextError;
        }
      }
    }
    throw new Error(error.message || "Edge function error");
  }

  if (!data?.success) {
    throw new Error(data?.message || data?.code || "Operation failed");
  }

  return data;
}

// ── API ────────────────────────────────────────────────────────────────────────

export async function listTenants(): Promise<TenantListItem[]> {
  const data = await callEdge("list_tenants", {});
  return data.tenants || [];
}

export async function getTenant(tenantId: string): Promise<TenantDetail> {
  const data = await callEdge("get_tenant", { tenantId });
  if (!data.tenant) throw new Error("Tenant not found");
  return data.tenant;
}

export async function provisionTenant(
  payload: ProvisionPayload,
): Promise<Record<string, unknown>> {
  const data = await callEdge("provision", payload as unknown as Record<string, unknown>);
  return data.result || {};
}

export async function suspendTenant(tenantId: string): Promise<void> {
  await callEdge("suspend", { tenantId });
}

export async function activateTenant(tenantId: string): Promise<void> {
  await callEdge("activate", { tenantId });
}

export async function endTenantContract(tenantId: string): Promise<void> {
  await callEdge("end_contract", { tenantId });
}

// ── Branding ───────────────────────────────────────────────────────────────

export async function createBrandingDraft(
  tenantId: string,
  theme: BrandingDraftPayload,
  reason: string,
): Promise<Record<string, unknown>> {
  const data = await callEdge("create_branding_draft", {
    tenantId,
    theme,
    reason,
  });
  return data.result || {};
}

export async function publishBranding(
  tenantId: string,
  brandingId: string,
  reason: string,
): Promise<Record<string, unknown>> {
  const data = await callEdge("publish_branding", {
    tenantId,
    brandingId,
    reason,
  });
  return data.result || {};
}

export async function getBrandingVersions(
  tenantId: string,
): Promise<Record<string, unknown>[]> {
  const data = await callEdge("list_branding_versions", { tenantId });
  return (data.versions || []) as Record<string, unknown>[];
}
