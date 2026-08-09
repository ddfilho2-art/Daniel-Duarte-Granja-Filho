import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { setSupabaseTenantId, supabase } from "../lib/supabase";

interface TenantBrandingPayload {
  displayName?: string;
  logoPrimaryPath?: string | null;
  logoLightPath?: string | null;
  faviconPath?: string | null;
  sidebarBackground?: string;
  sidebarText?: string;
  sidebarActive?: string;
  sidebarHover?: string;
  homeBackground?: string;
  heroBackground?: string;
  heroText?: string;
  primaryAction?: string;
  accent?: string;
  primaryColor?: string;
  secondaryColor?: string;
  linkColor?: string;
  focusRingColor?: string;
}

interface PublicTenantPayload {
  id: string;
  kind: "employer" | "occupational_health_provider";
  slug: string;
  displayName: string;
  brandingVersion: number;
  branding: TenantBrandingPayload;
}

export interface TenantBranding {
  displayName: string;
  logoPrimaryUrl: string | null;
  logoLightUrl: string | null;
  faviconUrl: string | null;
  sidebarBackground: string;
  sidebarText: string;
  sidebarActive: string;
  sidebarHover: string;
  homeBackground: string;
  heroBackground: string;
  heroText: string;
  primaryAction: string;
  accent: string;
  primaryColor: string;
  secondaryColor: string;
  linkColor: string;
  focusRingColor: string;
}

interface TenantContextValue {
  tenant: PublicTenantPayload | null;
  branding: TenantBranding;
  loading: boolean;
  error: string | null;
  isTenantRoute: boolean;
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const DEFAULT_BRANDING: TenantBranding = {
  displayName: "DFL",
  logoPrimaryUrl: null,
  logoLightUrl: null,
  faviconUrl: null,
  sidebarBackground: "#27336D",
  sidebarText: "#FFFFFF",
  sidebarActive: "#0054A6",
  sidebarHover: "#33417E",
  homeBackground: "#F8FAFC",
  heroBackground: "#0054A6",
  heroText: "#FFFFFF",
  primaryAction: "#00A859",
  accent: "#0054A6",
  primaryColor: "#0054A6",
  secondaryColor: "#27336D",
  linkColor: "#0054A6",
  focusRingColor: "#38BDF8",
};

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  branding: DEFAULT_BRANDING,
  loading: false,
  error: null,
  isTenantRoute: false,
});

function color(value: string | undefined, fallback: string): string {
  return value && HEX_COLOR.test(value) ? value.toUpperCase() : fallback;
}

function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return supabase.storage.from("tenant-branding").getPublicUrl(path).data.publicUrl;
}

function normalizeBranding(
  payload: TenantBrandingPayload | undefined,
  tenantDisplayName: string,
): TenantBranding {
  return {
    displayName: payload?.displayName?.trim() || tenantDisplayName,
    logoPrimaryUrl: assetUrl(payload?.logoPrimaryPath),
    logoLightUrl: assetUrl(payload?.logoLightPath),
    faviconUrl: assetUrl(payload?.faviconPath),
    sidebarBackground: color(
      payload?.sidebarBackground,
      DEFAULT_BRANDING.sidebarBackground,
    ),
    sidebarText: color(payload?.sidebarText, DEFAULT_BRANDING.sidebarText),
    sidebarActive: color(payload?.sidebarActive, DEFAULT_BRANDING.sidebarActive),
    sidebarHover: color(payload?.sidebarHover, DEFAULT_BRANDING.sidebarHover),
    homeBackground: color(payload?.homeBackground, DEFAULT_BRANDING.homeBackground),
    heroBackground: color(payload?.heroBackground, DEFAULT_BRANDING.heroBackground),
    heroText: color(payload?.heroText, DEFAULT_BRANDING.heroText),
    primaryAction: color(payload?.primaryAction, DEFAULT_BRANDING.primaryAction),
    accent: color(payload?.accent, DEFAULT_BRANDING.accent),
    primaryColor: color(payload?.primaryColor, DEFAULT_BRANDING.primaryColor),
    secondaryColor: color(
      payload?.secondaryColor,
      DEFAULT_BRANDING.secondaryColor,
    ),
    linkColor: color(payload?.linkColor, DEFAULT_BRANDING.linkColor),
    focusRingColor: color(
      payload?.focusRingColor,
      DEFAULT_BRANDING.focusRingColor,
    ),
  };
}

function applyBranding(branding: TenantBranding): () => void {
  const root = document.documentElement;
  const variables: Record<string, string> = {
    "--color-primary": branding.primaryColor,
    "--color-secondary": branding.secondaryColor,
    "--color-accent": branding.accent,
    "--color-ring": branding.focusRingColor,
    "--tenant-sidebar-background": branding.sidebarBackground,
    "--tenant-sidebar-text": branding.sidebarText,
    "--tenant-sidebar-active": branding.sidebarActive,
    "--tenant-sidebar-hover": branding.sidebarHover,
    "--tenant-home-background": branding.homeBackground,
    "--tenant-hero-background": branding.heroBackground,
    "--tenant-hero-text": branding.heroText,
    "--tenant-primary-action": branding.primaryAction,
    "--tenant-link-color": branding.linkColor,
  };

  const previous = new Map<string, string>();
  for (const [name, value] of Object.entries(variables)) {
    previous.set(name, root.style.getPropertyValue(name));
    root.style.setProperty(name, value);
  }

  document.title = `${branding.displayName} — Recrutamento`;

  let favicon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  const previousFavicon = favicon?.href || "";
  if (branding.faviconUrl) {
    if (!favicon) {
      favicon = document.createElement("link");
      favicon.rel = "icon";
      document.head.appendChild(favicon);
    }
    favicon.href = branding.faviconUrl;
  }

  return () => {
    for (const [name, value] of previous.entries()) {
      if (value) root.style.setProperty(name, value);
      else root.style.removeProperty(name);
    }
    if (favicon && previousFavicon) favicon.href = previousFavicon;
  };
}

export function TenantProvider({
  slug,
  children,
}: {
  slug: string | null;
  children: ReactNode;
}) {
  const [tenant, setTenant] = useState<PublicTenantPayload | null>(null);
  const [branding, setBranding] = useState<TenantBranding>(DEFAULT_BRANDING);
  const [loading, setLoading] = useState(Boolean(slug));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSupabaseTenantId(null);

    if (!slug) {
      setTenant(null);
      setBranding(DEFAULT_BRANDING);
      setError(null);
      setLoading(false);
      return () => undefined;
    }

    setLoading(true);
    setError(null);

    const loadTenant = async () => {
      try {
        const { data, error: rpcError } = await supabase.rpc(
          "get_public_tenant_context",
          { p_slug: slug },
        );
        if (!active) return;

        if (rpcError || !data || typeof data !== "object") {
          setTenant(null);
          setBranding(DEFAULT_BRANDING);
          setSupabaseTenantId(null);
          setError("Empresa não encontrada ou indisponível.");
          return;
        }

        const payload = data as unknown as PublicTenantPayload;
        if (!payload.id || payload.slug !== slug) {
          setTenant(null);
          setSupabaseTenantId(null);
          setError("O contexto da empresa retornado é inválido.");
          return;
        }

        const normalized = normalizeBranding(payload.branding, payload.displayName);
        setTenant(payload);
        setBranding(normalized);
        setSupabaseTenantId(payload.id);
      } catch {
        if (!active) return;
        setTenant(null);
        setBranding(DEFAULT_BRANDING);
        setSupabaseTenantId(null);
        setError("Não foi possível carregar esta empresa.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void loadTenant();

    return () => {
      active = false;
      setSupabaseTenantId(null);
    };
  }, [slug]);

  useEffect(() => applyBranding(branding), [branding]);

  const value = useMemo<TenantContextValue>(
    () => ({
      tenant,
      branding,
      loading,
      error,
      isTenantRoute: Boolean(slug),
    }),
    [tenant, branding, loading, error, slug],
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-primary" />
          <p className="text-sm text-slate-500">Carregando empresa...</p>
        </div>
      </div>
    );
  }

  if (slug && (error || !tenant)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">Site indisponível</h1>
          <p className="mt-3 text-slate-600">
            {error || "A empresa solicitada não está disponível."}
          </p>
          <a
            href="/"
            className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 font-medium text-white"
          >
            Voltar ao portal
          </a>
        </div>
      </div>
    );
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  return useContext(TenantContext);
}
