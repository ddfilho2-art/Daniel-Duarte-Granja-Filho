import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  Briefcase, Users, FileText, MessageSquare, CheckSquare, 
  Settings, LogOut, Home, Search, User, FileCheck, Shield, BarChart, KeyRound, X, Activity, Repeat
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';

const Logo = () => (
  <div className="flex items-center gap-2">
    <svg viewBox="0 0 600 100" className="h-10 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradAI" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00b4d8" />
          <stop offset="100%" stopColor="#001b54" />
        </linearGradient>
      </defs>

      {/* Symbol (New Reference) */}
      <g transform="translate(10, 15) scale(0.85)">
        {/* Dark blue left */}
        <path d="M 25 20 L 5 50 L 15 75 L 35 45 Z" fill="#24306e" />
        {/* Cyan right */}
        <path d="M 30 15 L 65 50 L 15 100 L 40 85 Z" fill="#00a7d0" />
      </g>

      {/* DFL Text (New Reference) */}
      <text x="85" y="70" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="56" fill="#24306e" letterSpacing="-2">DFL</text>
      
      {/* Vertical Line */}
      <line x1="225" y1="20" x2="210" y2="80" stroke="#00b4d8" strokeWidth="4" />

      <text x="235" y="70" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="56" fill="#001b54" letterSpacing="-1">Recruta</text>
      
      {/* AI */}
      <text x="465" y="70" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="56" fill="url(#gradAI)" letterSpacing="-2">AI</text>

      {/* Swooshes around AI */}
      <path d="M 460 40 C 480 15, 540 15, 560 25" fill="none" stroke="#001b54" strokeWidth="2" strokeLinecap="round" />
      <circle cx="560" cy="25" r="3" fill="#001b54" />
      
      <path d="M 465 30 C 490 10, 550 10, 570 20" fill="none" stroke="#00b4d8" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="570" cy="20" r="2.5" fill="#00b4d8" />

      <path d="M 470 80 C 510 95, 570 75, 580 45" fill="none" stroke="#0077b6" strokeWidth="3" strokeLinecap="round" />
      <circle cx="580" cy="45" r="3.5" fill="#0077b6" />

      <path d="M 460 90 C 500 110, 580 85, 590 35" fill="none" stroke="#00b4d8" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="590" cy="35" r="2" fill="#00b4d8" />
    </svg>
  </div>
);

export function PublicLayout() {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-primary transition-colors">Home</Link>
            <Link to="/vagas" className="hover:text-primary transition-colors">Vagas</Link>
            <Link to="/sobre" className="hover:text-primary transition-colors">Sobre Nós</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-primary transition-colors">Login</Link>
            <Link to="/cadastro" className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-lg hover:bg-accent transition-colors">
              Cadastre-se
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer className="bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <span className="text-xl font-bold text-white tracking-tight mb-4 block">DFL Recruta AI</span>
            <p className="text-sm">Conectando talentos ao futuro da saúde e odontologia.</p>
          </div>
          <div>
            <h3 className="text-white font-medium mb-4">Links Úteis</h3>
            <ul className="space-y-2 text-sm">
              <li><Link to="/vagas" className="hover:text-white transition-colors">Vagas Abertas</Link></li>
              <li><Link to="/sobre" className="hover:text-white transition-colors">Sobre a DFL</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Área do Candidato</Link></li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-sm text-center">
          &copy; {new Date().getFullYear()} DFL. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

function SidebarItem({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: number, key?: React.Key }) {
  const location = useLocation();
  const isBaseRoute = to === '/candidato' || to === '/rh' || to === '/admin';
  const isActive = isBaseRoute 
    ? location.pathname === to 
    : location.pathname === to || location.pathname.startsWith(to + '/');
  
  return (
    <Link 
      to={to} 
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-primary/10 text-primary' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  );
}

function DashboardLayout({ children, menuItems }: { children: React.ReactNode, menuItems: { to: string, icon: any, label: string, badge?: number }[] }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, profile, authLoading, profileLoading, isAuthenticated, signOut } = useAuth();
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const initialLoading = authLoading || profileLoading;

  React.useEffect(() => {
    // Só redireciona se o carregamento inicial e o refresh falharem/terminarem e o usuário não estiver autenticado
    if (!authLoading && !profileLoading && !isAuthenticated) {
      console.log("DashboardLayout: Redirecionando para login (não autenticado)");
      console.log('➡️ [NAVIGATION] disparada - Redirecionando para login (DashboardLayout)');
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, profileLoading, navigate]);
  
  // Find the most specific matching menu item
  const currentMenuItem = [...menuItems].reverse().find(item => {
    const isBaseRoute = item.to === '/candidato' || item.to === '/rh' || item.to === '/admin';
    return isBaseRoute 
      ? location.pathname === item.to 
      : location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  });

  const handleLogout = async () => {
    try {
      try {
        await logAudit('Logout', 'Autenticação', `Usuário encerrou a sessão.`);
      } catch (logError) {
        console.warn('Erro ao registrar log:', logError);
      }
      await signOut();
      console.log('➡️ [NAVIGATION] disparada - Logout (DashboardLayout)');
      navigate('/login');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword !== confirmPassword) {
      setPasswordError('As senhas não coincidem.');
      return;
    }

    if (newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]/.test(newPassword)) {
      setPasswordError('A senha deve ter no mínimo 8 caracteres, uma letra maiúscula e um símbolo.');
      return;
    }

    if (!user) {
      setPasswordError('Usuário não autenticado.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      
      try {
        await logAudit('Trocou Senha', 'Autenticação', `Usuário alterou a própria senha.`);
      } catch (logError) {
        console.warn('Erro ao registrar log:', logError);
      }
      setPasswordSuccess('Senha alterada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowPasswordModal(false), 2000);
    } catch (error: any) {
      console.error("Error changing password:", error);
      setPasswordError(error.message || 'Erro ao alterar a senha. Tente novamente.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const userName = profile?.nome || 'Usuário';
  const userRole = profile?.perfil || 'Perfil';
  const infraData = profile as any; // Alias para suportar o schema infraData do prompt no layout

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return null; // Will redirect in useEffect
  }

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <Link to="/">
            <Logo />
          </Link>
        </div>
        
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
              {infraData?.avatar_url ? (
                <img src={infraData.avatar_url} alt={userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                userName.charAt(0).toUpperCase()
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{userName}</p>
              <p className="text-xs text-slate-500 mb-1">{userRole}</p>
              <Link to={profile?.perfil.toLowerCase() === 'admin' ? '/admin/perfil' : '/rh/perfil'} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest transition-colors w-fit">
                Meu Perfil
              </Link>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item, index) => (
            <SidebarItem key={index} to={item.to} icon={item.icon} label={item.label} badge={item.badge} />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button 
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors"
          >
            <KeyRound className="w-5 h-5" />
            Trocar Senha
          </button>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 sticky top-0 z-10">
          <h1 className="text-lg font-medium text-slate-900 capitalize">
            {currentMenuItem?.label || 'Dashboard'}
          </h1>
        </header>
        <div className="flex-1 p-8">
          {children}
        </div>
      </main>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Trocar Senha</h3>
              <button 
                onClick={() => setShowPasswordModal(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              {passwordError && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm border border-red-100">
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="mb-4 p-3 bg-emerald-50 text-emerald-700 rounded-lg text-sm border border-emerald-100">
                  {passwordSuccess}
                </div>
              )}
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Nova Senha</label>
                  <input 
                    type="password" 
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">Mínimo 8 caracteres, com letra maiúscula e símbolo.</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Nova Senha</label>
                  <input 
                    type="password" 
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div className="pt-4 flex justify-end gap-3">
                  <button 
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={isChangingPassword}
                    className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {isChangingPassword ? 'Salvando...' : 'Salvar Nova Senha'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function CandidateLayout() {
  const menuItems = [
    { to: '/candidato', icon: Home, label: 'Dashboard' },
    { to: '/candidato/curriculo', icon: User, label: 'Meu Currículo' },
    { to: '/candidato/vagas', icon: Search, label: 'Buscar Vagas' },
    { to: '/candidato/candidaturas', icon: Briefcase, label: 'Minhas Candidaturas' },
    { to: '/candidato/mensagens', icon: MessageSquare, label: 'Mensagens' },
    { to: '/candidato/provas', icon: CheckSquare, label: 'Provas' },
  ];

  return (
    <DashboardLayout menuItems={menuItems}>
      <Outlet />
    </DashboardLayout>
  );
}

export function HRLayout() {
  const [triagemBadge, setTriagemBadge] = useState(0);
  const [entrevistasBadge, setEntrevistasBadge] = useState(0);
  const [provasBadge, setProvasBadge] = useState(0);
  const [mensagensBadge, setMensagensBadge] = useState(0);

  React.useEffect(() => {
    const fetchBadges = async () => {
      const { data: candidaturas, error } = await supabase
        .from('candidaturas')
        .select('*');

      if (error) {
        console.error('Error fetching badges:', error);
        return;
      }

      let triagemCount = 0;
      let entrevistasCount = 0;
      let mensagensCount = 0;

      candidaturas.forEach(data => {
        const fase = data.fase || 'Triagem';
        const status = data.status;

        // Triagem + Prova (Main Flow)
        if (!data.visualizado && !status && (fase === 'Triagem' || fase === 'Prova')) {
          triagemCount++;
        }

        // Entrevistas
        const entrevistaStages = [
          'Entrevista RH',
          'Entrevista Gestor',
          'Exame'
        ];
        if (!data.visualizado && !status && entrevistaStages.includes(fase)) {
          entrevistasCount++;
        }
        
        // Mensagens
        if (data.unread_messages_by_hr > 0) {
          mensagensCount += data.unread_messages_by_hr;
        }
      });

      setTriagemBadge(triagemCount);
      setEntrevistasBadge(entrevistasCount);
      setMensagensBadge(mensagensCount);
    };

    fetchBadges();

    // Subscribe to changes
    const subscription = supabase
      .channel('candidaturas_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'candidaturas' }, () => {
        fetchBadges();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const menuItems = [
    { to: '/rh', icon: Home, label: 'Dashboard RH' },
    { to: '/rh/vagas', icon: Briefcase, label: 'Gestão de Vagas' },
    { to: '/rh/candidatos', icon: Users, label: 'Candidatos', badge: triagemBadge },
    { to: '/rh/entrevistas', icon: Users, label: 'Processo de Recrut/Selec', badge: entrevistasBadge },
    { to: '/rh/mensagens', icon: MessageSquare, label: 'Mensagens', badge: mensagensBadge },
    { to: '/rh/provas', icon: CheckSquare, label: 'Provas' },
    { to: '/rh/talentos', icon: FileCheck, label: 'Banco de Talentos' },
    { to: '/rh/relatorios', icon: BarChart, label: 'Relatórios' },
     ];

  return (
    <DashboardLayout menuItems={menuItems}>
      <Outlet />
    </DashboardLayout>
  );
}

export function AdminLayout() {
  const menuItems = [
    { to: '/admin', icon: Home, label: 'Dashboard Admin' },
    { to: '/admin/users', icon: Users, label: 'Gestão de Usuários RH' },
    { to: '/admin/transferencias', icon: Repeat, label: 'Gestão de Transferências' },
    { to: '/admin/auditoria', icon: Shield, label: 'Auditoria' },
    { to: '/admin/performance', icon: Activity, label: 'Performance & SRE' },
    { to: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
  ];

  return (
    <DashboardLayout menuItems={menuItems}>
      <Outlet />
    </DashboardLayout>
  );
}
