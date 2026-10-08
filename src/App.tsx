import React from "react";
import {
  Routes,
  Route,
  Navigate,
  useLocation,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { UIProvider } from "./contexts/UIContext";
import { useTenant } from "./contexts/TenantContext";
import { resolveAuthorizedHomePath } from "./lib/tenant-access";

// Page-level code splitting: páginas são carregadas sob demanda.
const lazyNamed = (loader: () => Promise<any>, exportName: string) =>
  React.lazy(async () => {
    const module = await loader();
    return { default: module[exportName] };
  });

const {
  Login,
  Home,
  ListaVagas,
  DetalheVaga,
  Cadastro,
  SobreNos,
} = {
  Login: lazyNamed(() => import("./pages/Public"), "Login"),
  Home: lazyNamed(() => import("./pages/Public"), "Home"),
  ListaVagas: lazyNamed(() => import("./pages/Public"), "ListaVagas"),
  DetalheVaga: lazyNamed(() => import("./pages/Public"), "DetalheVaga"),
  Cadastro: lazyNamed(() => import("./pages/Public"), "Cadastro"),
  SobreNos: lazyNamed(() => import("./pages/Public"), "SobreNos"),
};

const VerifyEmail = lazyNamed(() => import("./pages/VerifyEmail"), "VerifyEmail");
const OccupationalHealthPortal = lazyNamed(
  () => import("./pages/OccupationalHealth"),
  "OccupationalHealthPortal",
);

const MasterDashboard = lazyNamed(() => import("./pages/Master"), "MasterDashboard");
const MasterTenantList = lazyNamed(() => import("./pages/Master"), "MasterTenantList");
const MasterBrandingEditor = lazyNamed(
  () => import("./pages/Master"),
  "MasterBrandingEditor",
);

const AdminDashboard = lazyNamed(() => import("./pages/Admin"), "AdminDashboard");
const AdminTransferencias = lazyNamed(
  () => import("./pages/Admin"),
  "AdminTransferencias",
);
const AdminGestaoUsuarios = lazyNamed(
  () => import("./pages/Admin"),
  "AdminGestaoUsuarios",
);
const AdminAuditoria = lazyNamed(() => import("./pages/Admin"), "AdminAuditoria");
const AdminConfiguracoes = lazyNamed(
  () => import("./pages/AdminConfiguracoes"),
  "AdminConfiguracoes",
);
const AdminPerformance = lazyNamed(
  () => import("./pages/AdminPerformance"),
  "AdminPerformance",
);
const PerfilAdmin = lazyNamed(() => import("./pages/PerfilAdmin"), "PerfilAdmin");

const HRDashboard = lazyNamed(() => import("./pages/HR"), "HRDashboard");
const HRGestaoVagas = lazyNamed(() => import("./pages/HR"), "HRGestaoVagas");
const HRNovaVaga = lazyNamed(() => import("./pages/HR"), "HRNovaVaga");
const HRCandidatos = lazyNamed(() => import("./pages/HR"), "HRCandidatos");
const HREntrevistas = lazyNamed(() => import("./pages/HR"), "HREntrevistas");
const HRMensagens = lazyNamed(() => import("./pages/HR"), "HRMensagens");
const HRBancoTalentos = lazyNamed(() => import("./pages/HR"), "HRBancoTalentos");
const HRProvas = lazyNamed(() => import("./pages/HR"), "HRProvas");
const HRProfile = lazyNamed(() => import("./pages/HR"), "HRProfile");
const HRDetalheVaga = lazyNamed(() => import("./pages/HRDetalheVaga"), "HRDetalheVaga");
const HRRelatorios = lazyNamed(() => import("./pages/HRRelatorios"), "HRRelatorios");

const CandidateDashboard = lazyNamed(
  () => import("./pages/Candidate"),
  "CandidateDashboard",
);
const CandidateCandidaturas = lazyNamed(
  () => import("./pages/Candidate"),
  "CandidateCandidaturas",
);
const CandidateMensagens = lazyNamed(
  () => import("./pages/Candidate"),
  "CandidateMensagens",
);
const CandidateResume = lazyNamed(
  () => import("./pages/Candidate"),
  "CandidateResume",
);
const CandidateVagas = lazyNamed(() => import("./pages/Candidate"), "CandidateVagas");

const PublicLayout = lazyNamed(
  () => import("./components/layouts/PublicLayout"),
  "PublicLayout",
);
const CandidateLayout = lazyNamed(
  () => import("./components/layouts/DashboardLayouts"),
  "CandidateLayout",
);
const HRLayout = lazyNamed(
  () => import("./components/layouts/DashboardLayouts"),
  "HRLayout",
);
const AdminLayout = lazyNamed(
  () => import("./components/layouts/DashboardLayouts"),
  "AdminLayout",
);
const MasterLayout = lazyNamed(
  () => import("./components/layouts/DashboardLayouts"),
  "MasterLayout",
);

const ProtectedRoute = ({
  children,
  allowedProfiles,
}: {
  children: React.ReactNode;
  allowedProfiles?: string[];
}) => {
  const {
    user,
    profile,
    authLoading,
    profileLoading,
    tenantMembershipLoading,
    tenantRoles,
    clinicRoles,
    hasClinicAccess,
    hasTenantAccess,
    canAdministerTenant,
    isPlatformMasterAdmin,
    isAuthenticated,
  } = useAuth();
  const { isTenantRoute } = useTenant();
  const location = useLocation();

  // CORREÇÃO 1: Enquanto qualquer dado de autenticação estiver carregando,
  // mantemos o Loading para evitar redirecionamentos precipitados.
  if (authLoading || profileLoading || tenantMembershipLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-slate-500 animate-pulse">
            Sincronizando acesso...
          </p>
        </div>
      </div>
    );
  }

  // CORREÇÃO 2: Verificação rigorosa de autenticação
  if (!isAuthenticated || !user) {
    console.log("➡️ [AUTH] Não autenticado. Redirecionando para login.");
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // CORREÇÃO 3: Se autenticado mas sem perfil após o loading, tentamos esperar ou forçamos logout
  if (!profile) {
    console.warn("➡️ [AUTH] Perfil ausente. Redirecionando.");
    return <Navigate to="/login" replace />;
  }

  const profileNormalized = profile.perfil.toLowerCase();

  if (location.pathname.startsWith("/master") && !isPlatformMasterAdmin) {
    return <Navigate to={isTenantRoute ? "/login" : "/"} replace />;
  }

  if (
    !isTenantRoute &&
    ["rh", "candidato"].includes(profileNormalized)
  ) {
    return <Navigate to="/login" replace />;
  }

  // O /admin representa a administração de uma empresa (tenant).
  // O administrador da plataforma usa exclusivamente a área /master.
  if (
    location.pathname.startsWith("/admin") &&
    !isTenantRoute &&
    isPlatformMasterAdmin
  ) {
    return <Navigate to="/master" replace />;
  }

  if (
    location.pathname.startsWith("/admin") &&
    !isTenantRoute &&
    !isPlatformMasterAdmin
  ) {
    return <Navigate to="/login" replace />;
  }

  if (isTenantRoute && !hasTenantAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-bold text-slate-900">Acesso não autorizado</h1>
          <p className="mt-3 text-sm text-slate-600">
            Sua conta não possui vínculo ativo com esta empresa.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="mt-6 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
          >
            Voltar ao portal
          </button>
        </div>
      </div>
    );
  }

  // A UI mantém compatibilidade com `perfil`, mas em uma rota tenant o papel
  // também precisa existir na membership autorizada pelo banco.
  if (allowedProfiles) {
    const userProfileNormalized = profile.perfil.toLowerCase();
    const legacyAllowed = allowedProfiles.some(
      (p) => p.toLowerCase() === userProfileNormalized,
    );
    const tenantAllowed = allowedProfiles.some((allowedProfile) => {
      const normalized = allowedProfile.toLowerCase();
      if (normalized === "admin") return canAdministerTenant;
      if (normalized === "rh") return tenantRoles.includes("hr");
      if (normalized === "candidato") return tenantRoles.includes("candidate");
      if (
        normalized === "clinica" ||
        normalized === "clínica" ||
        normalized === "empresa de exame"
      ) {
        return (
          hasClinicAccess ||
          tenantRoles.includes("clinic_admin") ||
          tenantRoles.includes("clinic_staff")
        );
      }
      return false;
    });
    const isAllowed = isTenantRoute ? tenantAllowed : legacyAllowed;

    if (!isAllowed) {
      const redirectPath =
        resolveAuthorizedHomePath(userProfileNormalized, isTenantRoute, {
          roles: tenantRoles,
          clinicRoles,
          canAdministerTenant,
        }) || "/";

      console.log(
        `➡️ [AUTH] Acesso negado para ${userProfileNormalized}. Indo para ${redirectPath}`,
      );
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
};

const App = () => {
  return (
    <AuthProvider>
      <UIProvider>
        <React.Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-slate-50">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
                <p className="text-sm text-slate-500">Carregando página...</p>
              </div>
            </div>
          }
        >
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/vagas" element={<ListaVagas />} />
              <Route path="/vagas/:id" element={<DetalheVaga />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/sobre" element={<SobreNos />} />
              <Route path="/login" element={<Login />} />
            </Route>

            {/* Master Admin Routes */}
            <Route
              path="/master"
              element={
                <ProtectedRoute allowedProfiles={["Admin"]}>
                  <MasterLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<MasterDashboard />} />
              <Route path="tenants" element={<MasterTenantList />} />
              <Route path="branding" element={<MasterBrandingEditor />} />\n              <Route path="perfil" element={<MasterProfile />} />
            </Route>

            <Route
              path="/saude-ocupacional"
              element={
                <ProtectedRoute allowedProfiles={["Clinica"]}>
                  <OccupationalHealthPortal />
                </ProtectedRoute>
              }
            />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedProfiles={["Admin"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminGestaoUsuarios />} />
              <Route path="transferencias" element={<AdminTransferencias />} />
              <Route path="auditoria" element={<AdminAuditoria />} />
              <Route path="performance" element={<AdminPerformance />} />
              <Route path="configuracoes" element={<AdminConfiguracoes />} />
              <Route path="perfil" element={<PerfilAdmin />} />
            </Route>

            {/* RH Routes */}
            <Route
              path="/rh"
              element={
                <ProtectedRoute allowedProfiles={["RH"]}>
                  <HRLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HRDashboard />} />
              <Route path="vagas" element={<HRGestaoVagas />} />
              <Route path="vagas/nova" element={<HRNovaVaga />} />
              <Route path="vagas/:id" element={<HRDetalheVaga />} />
              <Route path="candidatos" element={<HRCandidatos />} />
              <Route path="entrevistas" element={<HREntrevistas />} />
              <Route path="mensagens" element={<HRMensagens />} />
              <Route path="provas" element={<HRProvas />} />
              <Route path="talentos" element={<HRBancoTalentos />} />
              <Route path="relatorios" element={<HRRelatorios />} />
              <Route path="perfil" element={<HRProfile />} />
            </Route>

            {/* Candidate Routes */}
            <Route
              path="/candidato"
              element={
                <ProtectedRoute allowedProfiles={["Candidato"]}>
                  <CandidateLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<CandidateDashboard />} />
              <Route path="curriculo" element={<CandidateResume />} />
              <Route path="vagas" element={<CandidateVagas />} />
              <Route path="vagas/:id" element={<DetalheVaga />} />
              <Route path="candidaturas" element={<CandidateCandidaturas />} />
              <Route path="mensagens" element={<CandidateMensagens />} />
              <Route
                path="perfil"
                element={<Navigate to="curriculo" replace />}
              />
            </Route>

            {/* Fallback - Colocado como última opção para evitar falsos positivos */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </React.Suspense>
      </UIProvider>
    </AuthProvider>
  );
};

export default App;
