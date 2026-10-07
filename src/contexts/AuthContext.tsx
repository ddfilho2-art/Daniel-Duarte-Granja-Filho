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
import type { Session } from "@supabase/supabase-js";
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
import { registerCurrentCandidate } from "../lib/current-candidate";

interface AuthContextType {
  user: UserProfile | null;
  profile: UserProfile | null;
  authLoading: boolean;
  profileLoading: boolean;
  tenantMembershipLoading: boolean;
  authorizationLoading: boolean;
  tenantRoles: TenantRole[];
  clinicRoles: Extract<TenantRole, "clinic_admin" | "clinic_staff">[];
  clinicTenantIds: string[];
  hasClinicAccess: boolean;
  hasTenantAccess: boolean;
  canAdministerTenant: boolean;
  isPlatformMasterAdmin: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  login: (loginInput: string, passwordInput?: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => void;
  registerCandidateForTenant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  authLoading: true,
  profileLoading: true,
  tenantMembershipLoading: false,
  authorizationLoading: false,
  tenantRoles: [],
  clinicRoles: [],
  clinicTenantIds: [],
  hasClinicAccess: false,
  hasTenantAccess: false,
  canAdministerTenant: false,
  isPlatformMasterAdmin: false,
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  signOut: async () => {},
  refreshProfile: async () => {},
  updateProfile: () => {},
  registerCandidateForTenant: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const { tenant, isTenantRoute } = useTenant();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [authSession, setAuthSession] = useState<Session | null>(null);
  const [authorizationLoading, setAuthorizationLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);
  const [tenantMembershipLoading, setTenantMembershipLoading] = useState(
    isTenantRoute,
  );
  const [tenantRoles, setTenantRoles] = useState<TenantRole[]>([]);
  const [clinicRoles, setClinicRoles] = useState<
    Extract<TenantRole, "clinic_admin" | "clinic_staff">[]
  >([]);
  const [clinicTenantIds, setClinicTenantIds] = useState<string[]>([]);
  const [hasClinicAccess, setHasClinicAccess] = useState(false);
  const [hasTenantAccess, setHasTenantAccess] = useState(!isTenantRoute);
  const [canAdministerTenant, setCanAdministerTenant] = useState(false);
  const [isPlatformMasterAdmin, setIsPlatformMasterAdmin] = useState(false);
  const profileRequestId = useRef(0);
  const loginInProgressRef = useRef(false);

  const synchronizeProfile = useCallback(
    async (userId: string | null, session: Session | null) => {
      const requestId = ++profileRequestId.current;

      if (!userId || !session || session.user.id !== userId) {
        setAuthUserId(null);
        setAuthSession(null);
        setProfile(null);
        setTenantRoles([]);
        setClinicRoles([]);
        setClinicTenantIds([]);
        setHasClinicAccess(false);
        setHasTenantAccess(!isTenantRoute);
        setCanAdministerTenant(false);
        setTenantMembershipLoading(false);
        setProfileLoading(false);
        return;
      }

      setAuthSession(session);
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
        setClinicRoles([]);
        setClinicTenantIds([]);
        setHasClinicAccess(false);
        setHasTenantAccess(!isTenantRoute);
        setCanAdministerTenant(false);
        setTenantMembershipLoading(false);
      } finally {
        if (requestId === profileRequestId.current) setProfileLoading(false);
      }
    },
    [isTenantRoute],
  );

  useEffect(() => {
    let active = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      const userId = session?.user?.id || null;
      console.info("[AUTH DEBUG]", { event, userId, session: Boolean(session) });
      setAuthSession(session);

      if (event === "SIGNED_OUT") {
        queueMicrotask(() => {
          if (active) void synchronizeProfile(null, null);
        });
        return;
      }

      queueMicrotask(() => {
        if (active && !loginInProgressRef.current) {
          void synchronizeProfile(userId, session);
        }
      });
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [synchronizeProfile]);
  useEffect(() => {
    let active = true;

    const loadClinicAccess = async () => {
      if (!authSession || !authUserId || authSession.user.id !== authUserId) {
        setClinicRoles([]);
        setClinicTenantIds([]);
        setHasClinicAccess(false);
        return;
      }

      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const session = sessionData.session;
        console.info("[AUTH DEBUG]", {
          event: session ? "SESSION_PRESENT" : "SESSION_ABSENT",
          userId: session?.user?.id || authUserId,
          session: Boolean(session),
        });
        if (sessionError || !session || session.user.id !== authUserId) {
          console.warn("[RPC DEBUG]", {
            source: "clinic-effect",
            rpc: "get_current_clinic_access",
            userId: authUserId,
            session: false,
          });
          if (!active) return;
          setAuthSession(session || null);
          setClinicRoles([]);
          setClinicTenantIds([]);
          setHasClinicAccess(false);
          return;
        }
        console.info("[RPC DEBUG]", {
          source: "clinic-effect",
          rpc: "get_current_clinic_access",
          userId: session.user.id,
          session: true,
        });
        const { data, error } = await supabase.rpc("get_current_clinic_access");
        if (error) throw error;

        const payload = (data || {}) as Record<string, unknown>;
        const roles = Array.isArray(payload.roles)
          ? payload.roles.filter(
              (role): role is "clinic_admin" | "clinic_staff" =>
                role === "clinic_admin" || role === "clinic_staff",
            )
          : [];
        const tenantIds = Array.isArray(payload.tenantIds)
          ? payload.tenantIds.filter(
              (id): id is string => typeof id === "string",
            )
          : [];

        if (!active) return;
        setClinicRoles(roles);
        setClinicTenantIds(tenantIds);
        setHasClinicAccess(payload.hasAccess === true);
      } catch (error) {
        console.error("[AUTH] Falha ao validar acesso à clínica:", error);
        if (!active) return;
        setClinicRoles([]);
        setClinicTenantIds([]);
        setHasClinicAccess(false);
      }
    };

    void loadClinicAccess();

    return () => {
      active = false;
    };
  }, [authUserId, authSession]);

  useEffect(() => {
    let active = true;

    const loadPlatformAccess = async () => {
      if (!authSession || !authUserId || authSession.user.id !== authUserId) {
        setIsPlatformMasterAdmin(false);
        return;
      }

      setAuthorizationLoading(true);
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        const session = sessionData.session;
        console.info("[AUTH DEBUG]", {
          event: session ? "SESSION_PRESENT" : "SESSION_ABSENT",
          userId: session?.user?.id || authUserId,
          session: Boolean(session),
        });
        if (sessionError || !session || session.user.id !== authUserId) {
          console.warn("[RPC DEBUG]", {
            source: "platform-effect",
            rpc: "is_platform_master_admin",
            userId: authUserId,
            session: false,
          });
          if (active) setIsPlatformMasterAdmin(false);
          return;
        }
        console.info("[RPC DEBUG]", {
          source: "platform-effect",
          rpc: "is_platform_master_admin",
          userId: session.user.id,
          session: true,
        });
        const { data, error } = await supabase.rpc("is_platform_master_admin");
        if (error) throw error;
        if (active) setIsPlatformMasterAdmin(data === true);
      } catch (error) {
        console.warn("[AUTH] Não foi possível sincronizar acesso de plataforma:", error);
        if (active) setIsPlatformMasterAdmin(false);
      } finally {
        if (active) setAuthorizationLoading(false);
      }
    };

    void loadPlatformAccess();
    return () => {
      active = false;
    };
  }, [authUserId, authSession]);
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
    loginInProgressRef.current = true;
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
          if (nextProfile.perfil === "Candidato") {
            setAuthUserId(nextProfile.uid);
            setProfile(nextProfile);
            setTenantRoles([]);
            setHasTenantAccess(false);
            setCanAdministerTenant(false);
            setTenantMembershipLoading(false);
            throw new Error("CANDIDATE_TENANT_REGISTRATION_REQUIRED");
          }

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

      console.info("[AUTH DEBUG]", { event: "LOGIN_PROFILE_SYNCED", userId: nextProfile.uid, session: true });
    } catch (error) {
      const candidateRegistrationRequired =
        error instanceof Error &&
        error.message === "CANDIDATE_TENANT_REGISTRATION_REQUIRED";
      if (sessionEstablished && !candidateRegistrationRequired) await supabase.auth.signOut();
      if (!candidateRegistrationRequired) {
        setAuthUserId(null);
        setProfile(null);
      }
      if (!candidateRegistrationRequired) setTenantRoles([]);
      setClinicRoles([]);
      setClinicTenantIds([]);
      setHasClinicAccess(false);
      setIsPlatformMasterAdmin(false);
      if (!candidateRegistrationRequired) {
        setHasTenantAccess(!isTenantRoute);
        setCanAdministerTenant(false);
      }
      setTenantMembershipLoading(false);
      throw error;
    } finally {
      loginInProgressRef.current = false;
      setProfileLoading(false);
      setAuthLoading(false);
    }
  };

  const registerCandidateForTenant = async () => {
    if (!isTenantRoute || !tenant) {
      throw new Error("O cadastro do candidato precisa ser feito dentro do portal da empresa.");
    }
    if (!profile || profile.perfil !== "Candidato") {
      throw new Error("Somente candidatos podem concluir este cadastro.");
    }

    setTenantMembershipLoading(true);
    try {
      await registerCurrentCandidate(tenant.id);
      const access = await loadCurrentTenantAccess(tenant.id);
      if (!access.hasAccess || !access.roles.includes("candidate")) {
        throw new Error("O cadastro da empresa não foi ativado.");
      }
      setTenantRoles(access.roles);
      setHasTenantAccess(true);
      setCanAdministerTenant(access.canAdministerTenant);
    } finally {
      setTenantMembershipLoading(false);
    }
  };

  const signOut = async () => {
    console.info("[AUTH DEBUG]", { event: "SIGN_OUT_REQUESTED", source: "AuthContext.signOut", userId: authUserId, session: Boolean(authSession) });
    ++profileRequestId.current;
    setAuthUserId(null);
    setAuthSession(null);
    setProfile(null);
    setTenantRoles([]);
    setClinicRoles([]);
    setClinicTenantIds([]);
    setHasClinicAccess(false);
    setHasTenantAccess(!isTenantRoute);
    setCanAdministerTenant(false);
    setIsPlatformMasterAdmin(false);
    setTenantMembershipLoading(false);
    await supabase.auth.signOut();
  };

  const refreshProfile = async () => {
    const requestId = ++profileRequestId.current;
    setProfileLoading(true);
    try {
      const nextProfile = await loadCurrentProfile();
      const { data: sessionData } = await supabase.auth.getSession();
      const session = sessionData.session;
      if (requestId !== profileRequestId.current) return;
      if (!session || !nextProfile || session.user.id !== nextProfile.uid) {
        setAuthSession(session || null);
        setProfile(null);
        setAuthUserId(null);
        return;
      }
      setAuthSession(session);
      setProfile(nextProfile);
      setAuthUserId(nextProfile.uid);
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
      authorizationLoading,
      authorizationLoading,
      tenantRoles,
      clinicRoles,
      clinicTenantIds,
      hasClinicAccess,
      hasTenantAccess,
      canAdministerTenant,
      isPlatformMasterAdmin,
      isAuthenticated: Boolean(authUserId && profile),
      loading: authLoading || profileLoading || tenantMembershipLoading || authorizationLoading,
      login,
      signOut,
      refreshProfile,
      updateProfile,
      registerCandidateForTenant,
    }),
    [
      profile,
      authLoading,
      profileLoading,
      tenantMembershipLoading,
      tenantRoles,
      clinicRoles,
      clinicTenantIds,
      hasClinicAccess,
      hasTenantAccess,
      canAdministerTenant,
      isPlatformMasterAdmin,
      registerCandidateForTenant,
      authUserId,
      isTenantRoute,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
