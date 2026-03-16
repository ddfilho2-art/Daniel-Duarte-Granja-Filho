/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { PublicLayout, CandidateLayout, HRLayout, AdminLayout } from './components/Layouts';

// Public Pages
import { Home, ListaVagas, DetalheVaga, Cadastro, Login, SobreNos } from './pages/Public';

// Candidate Pages
import { CandidateDashboard, CandidateResume, CandidateVagas, CandidatePlaceholder, CandidateCandidaturas, CandidateMensagens, CandidateProvas } from './pages/Candidate';

// HR Pages
import { HRDashboard, HRGestaoVagas, HRCandidatosVaga, HRPlaceholder, HRCandidatos, HREntrevistas, HRProvas, HRMensagens, HRBancoTalentos, HRNovaVaga } from './pages/HR';

// Admin Pages
import { AdminDashboard, AdminGestaoUsuarios, AdminAuditoria } from './pages/Admin';

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/" element={<PublicLayout />}>
          <Route index element={<Home />} />
          <Route path="vagas" element={<ListaVagas />} />
          <Route path="vagas/:id" element={<DetalheVaga />} />
          <Route path="cadastro" element={<Cadastro />} />
          <Route path="login" element={<Login />} />
          <Route path="sobre" element={<SobreNos />} />
        </Route>

        {/* Candidate Routes */}
        <Route path="/candidato" element={<CandidateLayout />}>
          <Route index element={<CandidateDashboard />} />
          <Route path="curriculo" element={<CandidateResume />} />
          <Route path="vagas" element={<CandidateVagas />} />
          <Route path="vagas/:id" element={<DetalheVaga />} />
          <Route path="candidaturas" element={<CandidateCandidaturas />} />
          <Route path="mensagens" element={<CandidateMensagens />} />
          <Route path="provas" element={<CandidateProvas />} />
        </Route>

        {/* HR Routes */}
        <Route path="/rh" element={<HRLayout />}>
          <Route index element={<HRDashboard />} />
          <Route path="vagas" element={<HRGestaoVagas />} />
          <Route path="vagas/nova" element={<HRNovaVaga />} />
          <Route path="vagas/:id/candidatos" element={<HRCandidatosVaga />} />
          <Route path="candidatos" element={<HRCandidatos />} />
          <Route path="entrevistas" element={<HREntrevistas />} />
          <Route path="provas" element={<HRProvas />} />
          <Route path="mensagens" element={<HRMensagens />} />
          <Route path="talentos" element={<HRBancoTalentos />} />
        </Route>

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<AdminDashboard />} />
          <Route path="usuarios" element={<AdminGestaoUsuarios />} />
          <Route path="auditoria" element={<AdminAuditoria />} />
          <Route path="indicadores" element={<div className="p-8 text-center text-slate-500">Página em construção</div>} />
        </Route>
      </Routes>
    </Router>
  );
}

