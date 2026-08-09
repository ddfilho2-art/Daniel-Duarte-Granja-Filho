import { supabase } from "./supabase";

export type TenantRole =
  | "tenant_admin"
  | "tenant_admin_substitute"
  | "hr"
  | "candidate"
  | "clinic_admin"
  | "clinic_staff"
  | "auditor";

export interface TenantAccess {
  tenantId: string;
  roles: TenantRole[];
  hasAccess: boolean;
  canAdministerTenant: boolean;
  isPlatformMasterAdmin: boolean;
}

const TENANT_ROLES = new Set<TenantRole>([
  "tenant_admin",
  "tenant_admin_substitute",
  "hr",
  "candidate",
  "clinic_admin",
  "clinic_staff",
  "auditor",
]);

export function emptyTenantAccess(tenantId = ""): TenantAccess {
  return {
    tenantId,
    roles: [],
    hasAccess: false,
    canAdministerTenant: false,
    isPlatformMasterAdmin: false,
  };
}

function normalizeTenantAccess(data: unknown, tenantId: string): TenantAccess {
  if (!data || typeof data !== "object") {
    throw new Error("Resposta de acesso ao tenant inválida.");
  }

  const payload = data as Record<string, unknown>;
  if (payload.tenantId !== tenantId) {
    throw new Error("O tenant autorizado não corresponde à rota atual.");
  }

  const roles = Array.isArray(payload.roles)
    ? payload.roles.filter(
        (role): role is TenantRole =>
          typeof role === "string" && TENANT_ROLES.has(role as TenantRole),
      )
    : [];

  return {
    tenantId,
    roles,
    hasAccess: payload.hasAccess === true,
    canAdministerTenant: payload.canAdministerTenant === true,
    isPlatformMasterAdmin: payload.isPlatformMasterAdmin === true,
  };
}

export async function loadCurrentTenantAccess(
  tenantId: string,
): Promise<TenantAccess> {
  const { data, error } = await supabase.rpc("get_current_tenant_access", {
    p_tenant_id: tenantId,
  });

  if (error) throw error;
  return normalizeTenantAccess(data, tenantId);
}

export function resolveAuthorizedHomePath(
  legacyProfile: string | null | undefined,
  isTenantRoute: boolean,
  access: Pick<TenantAccess, "roles" | "canAdministerTenant">,
): string | null {
  if (isTenantRoute) {
    if (access.canAdministerTenant) return "/admin";
    if (access.roles.includes("hr")) return "/rh";
    if (access.roles.includes("candidate")) return "/candidato";
    return null;
  }

  switch (legacyProfile?.trim().toLocaleLowerCase("pt-BR")) {
    case "admin":
      return "/admin";
    case "rh":
      return "/rh";
    case "candidato":
      return "/candidato";
    default:
      return null;
  }
}
