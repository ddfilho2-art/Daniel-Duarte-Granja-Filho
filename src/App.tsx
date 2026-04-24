import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { UIProvider } from './contexts/UIContext';

// Public Pages
import { Login, Home, ListaVagas, DetalheVaga, Cadastro, SobreNos } from './pages/Public';

// Admin Pages
import { AdminDashboard, AdminTransferencias, AdminGestaoUsuarios, AdminAuditoria } from './pages/Admin';
import { AdminConfiguracoes } from './pages/AdminConfiguracoes';
import { AdminPerformance } from './pages/AdminPerformance';
import { PerfilAdmin } from './pages/PerfilAdmin';

// RH Pages
import { HRDashboard, HRGestaoVagas, HRNovaVaga, HRCandidatos, HREntrevistas, HRMensagens, HRBancoTalentos, HRProvas, HRProfile } from './pages/HR';
import { HRDetalheVaga } from './pages/HRDetalheVaga';
import { HRRelatorios } from './pages/HRRelatorios';

// Candidate Pages
import { CandidateDashboard, CandidateCandidaturas, CandidateMensagens, CandidateResume, CandidateVagas, CandidateProvas } from './pages/Candidate';

// Layouts
import { AdminLayout, HRLayout, CandidateLayout, PublicLayout } from './components/Layouts';

const ProtectedRoute = ({ children, allowedProfiles }: { children: React.ReactNode, allowedProfiles?: string[] }) => {
  const { user, profile, authLoading, profileLoading, isAuthenticated } = useAuth();
  const location = useLocation();

  // Log detalhado para diagnóstico
  console.log('🛡️ [ROUTE-CHECK]', {
    path: location.pathname,
    authLoading,
    profileLoading,
    hasUser: !!user,
    hasProfile: !!profile,
    profileType: profile?.perfil
  });

  // CORREÇÃO 1: Enquanto qualquer dado de autenticação estiver carregando, 
  // mantemos o Loading para evitar redirecionamentos precipitados.
  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-sm text-slate-500 animate-pulse">Sincronizando acesso...</p>
        </div>
      </div>
    );
  }

  // CORREÇÃO 2: Verificação rigorosa de autenticação
  if (!isAuthenticated || !user) {
    console.log('➡️ [AUTH] Não autenticado. Redirecionando para login.');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // CORREÇÃO 3: Se autenticado mas sem perfil após o loading, tentamos esperar ou forçamos logout
  if (!profile) {
    console.warn("➡️ [AUTH] Perfil ausente. Redirecionando.");
    return <Navigate to="/login" replace />;
  }

  // CORREÇÃO 4: Verificação de perfil permitida (Case Insensitive)
  if (allowedProfiles) {
    const userProfileNormalized = profile.perfil.toLowerCase();
    const isAllowed = allowedProfiles.some(p => p.toLowerCase() === userProfileNormalized);

    if (!isAllowed) {
      const redirectPath = userProfileNormalized === 'admin' ? '/admin' : 
                           userProfileNormalized === 'rh' ? '/rh' : '/candidato';
      
      console.log(`➡️ [AUTH] Acesso negado para ${userProfileNormalized}. Indo para ${redirectPath}`);
      return <Navigate to={redirectPath} replace />;
    }
  }

  return <>{children}</>;
};

const App = () => {
  return (
    <AuthProvider>
      <UIProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Home />} />
              <Route path="/vagas" element={<ListaVagas />} />
              <Route path="/vagas/:id" element={<DetalheVaga />} />
              <Route path="/cadastro" element={<Cadastro />} />
              <Route path="/sobre" element={<SobreNos />} />
              <Route path="/login" element={<Login />} />
            </Route>
            
            {/* Admin Routes */}
            <Route path="/admin" element={<ProtectedRoute allowedProfiles={['Admin']}><AdminLayout /></ProtectedRoute>}>
              <Route index element={<AdminDashboard />} />
              <Route path="users" element={<AdminGestaoUsuarios />} />
              <Route path="transferencias" element={<AdminTransferencias />} />
              <Route path="auditoria" element={<AdminAuditoria />} />
              <Route path="performance" element={<AdminPerformance />} />
              <Route path="configuracoes" element={<AdminConfiguracoes />} />
              <Route path="perfil" element={<PerfilAdmin />} />
            </Route>

            {/* RH Routes */}
            <Route path="/rh" element={<ProtectedRoute allowedProfiles={['RH']}><HRLayout /></ProtectedRoute>}>
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
            <Route path="/candidato" element={<ProtectedRoute allowedProfiles={['Candidato']}><CandidateLayout /></ProtectedRoute>}>
              <Route index element={<CandidateDashboard />} />
              <Route path="curriculo" element={<CandidateResume />} />
              <Route path="vagas" element={<CandidateVagas />} />
              <Route path="vagas/:id" element={<DetalheVaga />} />
              <Route path="candidaturas" element={<CandidateCandidaturas />} />
              <Route path="mensagens" element={<CandidateMensagens />} />
              <Route path="provas" element={<CandidateProvas />} />
              <Route path="perfil" element={<Navigate to="curriculo" replace />} />
            </Route>

            {/* Fallback - Colocado como última opção para evitar falsos positivos */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </UIProvider>
    </AuthProvider>
  );
};

export default App;