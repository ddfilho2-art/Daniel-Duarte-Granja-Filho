import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Public Pages
import { Login, Home, ListaVagas, DetalheVaga, Cadastro, SobreNos } from './pages/Public';

// Admin Pages
import { AdminDashboard, AdminTransferencias, AdminGestaoUsuarios, AdminAuditoria } from './pages/Admin';
import { AdminConfiguracoes } from './pages/AdminConfiguracoes';
import { AdminPerformance } from './pages/AdminPerformance';

// RH Pages
import { HRDashboard, HRGestaoVagas, HRNovaVaga, HRCandidatos, HREntrevistas, HRMensagens, HRBancoTalentos, HRProvas } from './pages/HR';
import { HRDetalheVaga } from './pages/HRDetalheVaga';
import { HRRelatorios } from './pages/HRRelatorios';

// Candidate Pages
import { CandidateDashboard, CandidateCandidaturas, CandidateMensagens, CandidateResume, CandidateVagas, CandidateProvas } from './pages/Candidate';

// Layouts
import { AdminLayout, HRLayout, CandidateLayout, PublicLayout } from './components/Layouts';

const ProtectedRoute = ({ children, allowedProfiles }: { children: React.ReactNode, allowedProfiles?: string[] }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Se temos usuário mas não temos perfil (e não estamos carregando), 
  // algo deu errado no carregamento do perfil ou o usuário não tem perfil vinculado.
  if (!profile && !loading) {
    return <Navigate to="/login" replace />;
  }

  if (allowedProfiles && profile && !allowedProfiles.includes(profile.perfil)) {
    const profileLower = profile.perfil.toLowerCase();
    const redirectPath = profileLower === 'admin' ? '/admin' : profileLower === 'rh' ? '/rh' : '/candidato';
    return <Navigate to={redirectPath} replace />;
  }

  return <>{children}</>;
};

const App = () => {
  return (
    <AuthProvider>
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
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
