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

// Public Pages
import {
  Login,
  Home,
  ListaVagas,
  DetalheVaga,
  Cadastro,
  SobreNos,
} from "./pages/Public";
import { VerifyEmail } from "./pages/VerifyEmail";
import { OccupationalHealthPortal } from "./pages/OccupationalHealth";

// Master Admin Pages
import {
  MasterDashboard,
  MasterTenantList,
  MasterBrandingEditor,
} from "./pages/Master";

// Admin Pages
import {
  AdminDashboard,
  AdminTransferencias,
  AdminGestaoUsuarios,
  AdminAuditoria,
} from "./pages/Admin";
import { AdminConfiguracoes } from "./pages/AdminConfiguracoes";
import { AdminPerformance } from "./pages/AdminPerformance";
import { PerfilAdmin } from "./pages/PerfilAdmin";

// RH Pages
import {
  HRDashboard,
  HRGestaoVagas,
  HRNovaVaga,
  HRCandidatos,
  HREntrevistas,
  HRMensagens,
  HRBancoTalentos,
  HRProvas,
  HRProfile,
} from "./pages/HR";
import { HRDetalheVaga } from "./pages/HRDetalheVaga";
import { HRRelatorios } from "./pages/HRRelatorios";

// Candidate Pages
import {
  CandidateDashboard,
  CandidateCandidaturas,
  CandidateMensagens,
  CandidateResume,
  CandidateVagas,
} from "./pages/Candidate";

// Layouts
import {
  AdminLayout,
  HRLayout,
  CandidateLayout,
  PublicLayout,
  MasterLayout,
} from "./components/Layouts";

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
    hasTenantAccess,
    canAdministerTenant,
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
      return false;
    });
    const isAllowed = isTenantRoute ? tenantAllowed : legacyAllowed;

    if (!isAllowed) {
      const redirectPath =
        resolveAuthorizedHomePath(userProfileNormalized, isTenantRoute, {
          roles: tenantRoles,
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
              <Route path="branding" element={<MasterBrandingEditor />} />
            </Route>

            <Route
              path="/saude-ocupacional"
              element={
                <ProtectedRoute>
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
      </UIProvider>
    </AuthProvider>
  );
};

export default App;
