export interface TenantRoute {
  slug: string | null;
  basename: string;
}

const TENANT_SLUG = /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/;

export function resolveTenantRoute(pathname: string): TenantRoute {
  const match = pathname.match(/^\/t\/([^/]+)(?:\/|$)/i);
  if (!match) return { slug: null, basename: "/" };

  let decoded = "";
  try {
    decoded = decodeURIComponent(match[1]).trim().toLowerCase();
  } catch {
    decoded = "invalid-tenant";
  }

  const slug = TENANT_SLUG.test(decoded) ? decoded : "invalid-tenant";
  return {
    slug,
    basename: `/t/${match[1]}`,
  };
}
