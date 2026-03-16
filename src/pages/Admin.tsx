import { Link } from 'react-router-dom';
import { Users, Shield, BarChart, Plus, Search, Activity, Ban, Snowflake, Unlock, CheckCircle2 } from 'lucide-react';
import { useState } from 'react';

export function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Usuários RH Ativos</p>
              <h3 className="text-2xl font-bold text-slate-900">24</h3>
            </div>
          </div>
          <Link to="/admin/usuarios" className="text-sm text-primary font-medium hover:underline">Gerenciar usuários</Link>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Acessos Hoje</p>
              <h3 className="text-2xl font-bold text-slate-900">1,245</h3>
            </div>
          </div>
          <Link to="/admin/auditoria" className="text-sm text-primary font-medium hover:underline">Ver logs de auditoria</Link>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
              <BarChart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Vagas Preenchidas (Mês)</p>
              <h3 className="text-2xl font-bold text-slate-900">18</h3>
            </div>
          </div>
          <Link to="/admin/indicadores" className="text-sm text-primary font-medium hover:underline">Ver indicadores</Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">Últimas Atividades do Sistema</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                  <Shield className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-medium text-slate-900">Login efetuado</h4>
                  <p className="text-sm text-slate-500">Usuário: maria.rh@dfl.com.br</p>
                </div>
              </div>
              <span className="text-xs text-slate-400">Há 5 minutos</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AdminGestaoUsuarios() {
  const [usuarios, setUsuarios] = useState([
    { id: 1, nome: 'Maria RH 1', email: 'maria.rh1@dfl.com.br', perfil: 'Recrutador', status: 'Ativo' },
    { id: 2, nome: 'Maria RH 2', email: 'maria.rh2@dfl.com.br', perfil: 'Recrutador', status: 'Ativo' },
    { id: 3, nome: 'Maria RH 3', email: 'maria.rh3@dfl.com.br', perfil: 'Recrutador', status: 'Congelado' },
    { id: 4, nome: 'Maria RH 4', email: 'maria.rh4@dfl.com.br', perfil: 'Recrutador', status: 'Inativo' },
    { id: 5, nome: 'Maria RH 5', email: 'maria.rh5@dfl.com.br', perfil: 'Recrutador', status: 'Ativo' },
  ]);

  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleStatusChange = (id: number, novoStatus: string) => {
    setUsuarios(usuarios.map(u => u.id === id ? { ...u, status: novoStatus } : u));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Ativo':
        return <span className="bg-emerald-100 text-emerald-700 px-3 py-1 rounded-full text-xs font-medium">Ativo</span>;
      case 'Congelado':
        return <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">Congelado</span>;
      case 'Inativo':
        return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-medium">Inativo</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 px-3 py-1 rounded-full text-xs font-medium">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 w-full max-w-md">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder="Buscar usuários RH..." 
            className="w-full px-2 py-1 focus:outline-none"
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors flex items-center gap-2 text-sm"
        >
          <Plus className="w-4 h-4" /> Novo Usuário RH
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Email</th>
                <th className="px-6 py-4">Perfil</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {usuarios.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                        MR
                      </div>
                      {u.nome}
                    </div>
                  </td>
                  <td className="px-6 py-4">{u.email}</td>
                  <td className="px-6 py-4">{u.perfil}</td>
                  <td className="px-6 py-4">
                    {getStatusBadge(u.status)}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <div className="flex items-center justify-center gap-3">
                      {u.status === 'Ativo' && (
                        <button 
                          onClick={() => handleStatusChange(u.id, 'Congelado')}
                          className="text-amber-500 hover:text-amber-700 transition-colors" 
                          title="Congelar Acesso (Férias)"
                        >
                          <Snowflake className="w-5 h-5" />
                        </button>
                      )}
                      {u.status === 'Congelado' && (
                        <button 
                          onClick={() => handleStatusChange(u.id, 'Ativo')}
                          className="text-emerald-500 hover:text-emerald-700 transition-colors" 
                          title="Descongelar Acesso"
                        >
                          <Unlock className="w-5 h-5" />
                        </button>
                      )}
                      {u.status !== 'Inativo' && (
                        <button 
                          onClick={() => handleStatusChange(u.id, 'Inativo')}
                          className="text-red-500 hover:text-red-700 transition-colors" 
                          title="Inativar Usuário"
                        >
                          <Ban className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-lg max-w-md w-full">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Novo Usuário RH</h3>
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); setIsModalOpen(false); }}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo</label>
                <input required type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input required type="email" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Usuário de Login</label>
                <input 
                  required 
                  type="text" 
                  pattern="^(?=.*[A-Z])(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-])[a-zA-Z0-9!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]{8,}$"
                  title="Mínimo 8 caracteres, contendo pelo menos uma letra maiúscula e um símbolo"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                />
                <p className="text-[10px] text-slate-500 mt-1">Mínimo 8 caracteres, com letra maiúscula e símbolo.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Senha Inicial</label>
                <input required type="password" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500">Esta página está em construção.</p>
    </div>
  );
}

export function AdminAuditoria() {
  const logs = [
    { id: 1, data: '16/03/2026 10:15:22', usuario: 'Admin Master', acao: 'Inativou Usuário', modulo: 'Gestão de Usuários', detalhes: 'Usuário Maria RH 4 inativado.' },
    { id: 2, data: '16/03/2026 09:42:10', usuario: 'Maria RH 1', acao: 'Criou Vaga', modulo: 'Gestão de Vagas', detalhes: 'Vaga "Engenheiro de Produção Sênior" criada.' },
    { id: 3, data: '15/03/2026 16:30:05', usuario: 'João Silva (Candidato)', acao: 'Candidatura', modulo: 'Portal do Candidato', detalhes: 'Candidatou-se à vaga "Gerente de Projetos".' },
    { id: 4, data: '15/03/2026 14:20:00', usuario: 'Admin Master', acao: 'Congelou Acesso', modulo: 'Gestão de Usuários', detalhes: 'Acesso de Maria RH 3 congelado (Férias).' },
    { id: 5, data: '14/03/2026 11:05:33', usuario: 'Sistema', acao: 'Envio de E-mail', modulo: 'Comunicações', detalhes: 'E-mail de feedback enviado para 15 candidatos.' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Trilha de Auditoria (Audit Trail)</h2>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 w-full max-w-md">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input 
            type="text" 
            placeholder="Buscar logs..." 
            className="w-full px-2 py-1 focus:outline-none"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Data/Hora</th>
                <th className="px-6 py-4">Usuário</th>
                <th className="px-6 py-4">Ação</th>
                <th className="px-6 py-4">Módulo</th>
                <th className="px-6 py-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-slate-500">{log.data}</td>
                  <td className="px-6 py-4 font-medium text-slate-900">{log.usuario}</td>
                  <td className="px-6 py-4">
                    <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">
                      {log.acao}
                    </span>
                  </td>
                  <td className="px-6 py-4">{log.modulo}</td>
                  <td className="px-6 py-4 text-slate-500">{log.detalhes}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
