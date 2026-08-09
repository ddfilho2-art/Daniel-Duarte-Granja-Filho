import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { supabase } from "../lib/supabase";
import {
  loadCurrentProfile,
  loadProfileForAuthUser,
  loginWithLogin,
  type UserProfile,
} from "../lib/authService";
import {
  emptyTenantAccess,
  loadCurrentTenantAccess,
  type TenantRole,
} from "../lib/tenant-access";
import { useTenant } from "./TenantContext";

interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  tenantMembershipLoading: boolean;
  tenantRoles: TenantRole[];
  hasTenantAccess: boolean;
  canAdministerTenant: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  login: (loginInput: string, passwordInput?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  authLoading: true,
  profileLoading: true,
  tenantMembershipLoading: false,
  tenantRoles: [],
  hasTenantAccess: false,
  canAdministerTenant: false,
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfile: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { tenant, isTenantRoute } = useTenant();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tenantMembershipLoading, setTenantMembershipLoading] = useState(
    isTenantRoute,
  );
  const [tenantRoles, setTenantRoles] = useState<TenantRole[]>([]);
  const [hasTenantAccess, setHasTenantAccess] = useState(!isTenantRoute);
  const [canAdministerTenant, setCanAdministerTenant] = useState(false);
  const profileRequestId = useRef(0);

  const synchronizeProfile = useCallback(
    async (userId: string | null) => {
      const requestId = ++profileRequestId.current;

      if (!userId) {
        setAuthUserId(null);
        setProfile(null);
        setTenantRoles([]);
        setHasTenantAccess(!isTenantRoute);
        setCanAdministerTenant(false);
        setTenantMembershipLoading(false);
        setProfileLoading(false);
        return;
      }

      setProfileLoading(true);
      if (isTenantRoute) setTenantMembershipLoading(true);
      try {
        const nextProfile = await loadProfileForAuthUser(userId);
        if (requestId !== profileRequestId.current) return;
        setAuthUserId(userId);
        setProfile(nextProfile);
      } catch (error) {
        if (requestId !== profileRequestId.current) return;
        console.error("[AUTH] Falha ao carregar perfil autenticado:", error);
        setAuthUserId(null);
        setProfile(null);
        setTenantRoles([]);
        setHasTenantAccess(!isTenantRoute);
        setCanAdministerTenant(false);
        setTenantMembershipLoading(false);
        await supabase.auth.signOut();
      } finally {
        if (requestId === profileRequestId.current) setProfileLoading(false);
      }
    },
    [isTenantRoute],
  );

  useEffect(() => {
    let active = true;

    const initialize = async () => {
      setAuthLoading(true);
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (error) console.warn("[AUTH] Sessão inválida ou expirada:", error);
      if (active) await synchronizeProfile(user?.id || null);
      if (active) setAuthLoading(false);
    };

    void initialize();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (active) void synchronizeProfile(session?.user?.id || null);
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [synchronizeProfile]);

  useEffect(() => {
    let active = true;

    const loadMembership = async () => {
      if (!isTenantRoute) {
        setTenantRoles([]);
        setHasTenantAccess(true);
        setCanAdministerTenant(false);
        setTenantMembershipLoading(false);
        return;
      }

      if (!tenant || !authUserId) {
        const access = emptyTenantAccess(tenant?.id);
        setTenantRoles(access.roles);
        setHasTenantAccess(access.hasAccess);
        setCanAdministerTenant(access.canAdministerTenant);
        setTenantMembershipLoading(false);
        return;
      }

      setTenantMembershipLoading(true);
      try {
        const access = await loadCurrentTenantAccess(tenant.id);
        if (!active) return;
        setTenantRoles(access.roles);
        setHasTenantAccess(access.hasAccess);
        setCanAdministerTenant(access.canAdministerTenant);
      } catch (error) {
        console.error("[AUTH] Falha ao validar acesso ao tenant:", error);
        if (!active) return;
        const access = emptyTenantAccess(tenant.id);
        setTenantRoles(access.roles);
        setHasTenantAccess(access.hasAccess);
        setCanAdministerTenant(access.canAdministerTenant);
      } finally {
        if (active) setTenantMembershipLoading(false);
      }
    };

    void loadMembership();
    return () => {
      active = false;
    };
  }, [authUserId, isTenantRoute, tenant]);

  const login = async (loginInput: string, passwordInput?: string) => {
    let sessionEstablished = false;
    setAuthLoading(true);
    setProfileLoading(true);
    if (isTenantRoute) setTenantMembershipLoading(true);
    try {
      const nextProfile = await loginWithLogin(loginInput, passwordInput);
      sessionEstablished = true;

      if (isTenantRoute) {
        if (!tenant) throw new Error("Empresa não encontrada ou indisponível.");

        const access = await loadCurrentTenantAccess(tenant.id);
        if (!access.hasAccess) {
          await supabase.auth.signOut();
          throw new Error(
            "Sua conta não possui vínculo ativo com esta empresa.",
          );
        }

        setTenantRoles(access.roles);
        setHasTenantAccess(true);
        setCanAdministerTenant(access.canAdministerTenant);
        setTenantMembershipLoading(false);
      }

      setAuthUserId(nextProfile.uid);
      setProfile(nextProfile);
    } catch (error) {
      if (sessionEstablished) await supabase.auth.signOut();
      setAuthUserId(null);
      setProfile(null);
      setTenantRoles([]);
      setHasTenantAccess(!isTenantRoute);
      setCanAdministerTenant(false);
      setTenantMembershipLoading(false);
      throw error;
    } finally {
      setProfileLoading(false);
      setAuthLoading(false);
    }
  };

  const signOut = async () => {
    ++profileRequestId.current;
    setAuthUserId(null);
    setProfile(null);
    setTenantRoles([]);
    setHasTenantAccess(!isTenantRoute);
    setCanAdministerTenant(false);
    setTenantMembershipLoading(false);
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    const requestId = ++profileRequestId.current;
    setProfileLoading(true);
    try {
      const nextProfile = await loadCurrentProfile();
      if (requestId !== profileRequestId.current) return;
      setProfile(nextProfile);
      setAuthUserId(nextProfile?.uid || null);
    } finally {
      if (requestId === profileRequestId.current) setProfileLoading(false);
    }
  };

  const updateProfile = (data: Partial<UserProfile>) => {
    setProfile((current) => (current ? { ...current, ...data } : current));
  };

  const value = useMemo<AuthContextType>(
    () => ({
      user: profile,
      profile,
      authLoading,
      profileLoading,
      tenantMembershipLoading,
      tenantRoles,
      hasTenantAccess,
      canAdministerTenant,
      isAuthenticated: Boolean(authUserId && profile),
      loading: authLoading || profileLoading || tenantMembershipLoading,
      login,
      signOut,
      refreshProfile,
      updateProfile,
    }),
    [
      profile,
      authLoading,
      profileLoading,
      tenantMembershipLoading,
      tenantRoles,
      hasTenantAccess,
      canAdministerTenant,
      authUserId,
      isTenantRoute,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
