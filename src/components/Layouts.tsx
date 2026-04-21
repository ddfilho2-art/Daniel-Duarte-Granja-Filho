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
      <g transform="translate(10, 15) scale(0.85)">
        <path d="M 25 20 L 5 50 L 15 75 L 35 45 Z" fill="#24306e" />
        <path d="M 30 15 L 65 50 L 15 100 L 40 85 Z" fill="#00a7d0" />
      </g>
      <text x="85" y="70" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="56" fill="#24306e" letterSpacing="-2">DFL</text>
      <line x1="225" y1="20" x2="210" y2="80" stroke="#00b4d8" strokeWidth="4" />
      <text x="235" y="70" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="56" fill="#001b54" letterSpacing="-1">Recruta</text>
      <text x="465" y="70" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="56" fill="url(#gradAI)" letterSpacing="-2">AI</text>
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-slate-800 text-sm text-center">
          &copy; {new Date().getFullYear()} DFL. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

function SidebarItem({ to, icon: Icon, label, badge }: { to: string, icon: any, label: string, badge?: number }) {
  const location = useLocation();
  const isActive = location.pathname === to || location.pathname.startsWith(to + '/');
  
  return (
    <Link 
      to={to} 
      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive ? 'bg-primary/10 text-primary' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        {label}
      </div>
      {badge !== undefined && badge > 0 && (
        <span className="flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full">
          {badge}
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
  const [imgLoadError, setImgLoadError] = useState(false);

  React.useEffect(() => {
    if (!authLoading && !profileLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, authLoading, profileLoading, navigate]);

  // Reset do erro ao trocar de foto para garantir que a nova tentativa ocorra
  // ANTES
  // React.useEffect(() => {
  //   setImgLoadError(false);
  // }, [profile?.avatar_url, (profile as any)?.foto_url]);
  // DEPOIS
  React.useEffect(() => {
    setImgLoadError(false);
  }, [profile?.avatar_url, profile?.foto_url]);

  const handleLogout = async () => {
    try {
      await logAudit('Logout', 'Autenticação', `Usuário encerrou a sessão.`);
      await signOut();
      navigate('/login');
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) { setPasswordError('As senhas não coincidem.'); return; }
    setIsChangingPassword(true);
    setPasswordError('');
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordSuccess('Senha alterada com sucesso!');
      setTimeout(() => {
        setShowPasswordModal(false);
        setPasswordSuccess('');
        setNewPassword('');
        setConfirmPassword('');
      }, 2000);
    } catch (err: any) { 
      setPasswordError(err.message || 'Erro ao alterar senha.');
    } finally { 
      setIsChangingPassword(false); 
    }
  };

  const userName = profile?.nome || 'Usuário';
  const userAvatar = profile?.avatar_url || (profile as any)?.foto_url;
  
  // Memoização simples para evitar reverse() desnecessário
  const currentMenuItem = React.useMemo(() => 
    [...menuItems].reverse().find(item => location.pathname.startsWith(item.to)),
    [location.pathname, menuItems]
  );

  if (authLoading || profileLoading) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col fixed h-full z-10">
        <div className="h-16 flex items-center px-6 border-b border-slate-200">
          <Link to="/"><Logo /></Link>
        </div>
        
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0 border border-slate-100">
              {/* Key dinâmica força o re-render da imagem se a URL mudar */}
              {userAvatar && !imgLoadError ? (
                <img 
                  // ANTES
                  // key={`${profile?.avatar_url || ''}_${(profile as any)?.foto_url || ''}`}
                  // DEPOIS
                  key={`${profile?.avatar_url || ''}_${profile?.foto_url || ''}`}
                  src={userAvatar} 
                  alt={userName} 
                  className="w-full h-full object-cover" 
                  referrerPolicy="no-referrer"
                  onError={() => setImgLoadError(true)}
                />
              ) : (
                <span className="text-lg">{userName.charAt(0).toUpperCase()}</span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">{userName}</p>
              <Link 
                to={profile?.perfil?.toLowerCase() === 'admin' ? '/admin/perfil' : '/rh/perfil'} 
                className="text-[10px] font-bold text-primary hover:underline uppercase tracking-widest"
              >
                Meu Perfil
              </Link>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item, index) => <SidebarItem key={index} {...item} />)}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-2">
          <button 
            onClick={() => setShowPasswordModal(true)} 
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <KeyRound className="w-5 h-5" />Senha
          </button>
          <button 
            onClick={handleLogout} 
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 sticky top-0 z-10">
          <h1 className="text-lg font-medium text-slate-900">
            {currentMenuItem?.label || 'Dashboard'}
          </h1>
        </header>
        <div className="flex-1 p-8"><Outlet /></div>
      </main>

      {/* Modal de Senha com Correções de UI */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Segurança da Conta</h3>
              <button onClick={() => setShowPasswordModal(false)} className="text-slate-400 hover:text-slate-600">
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
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Nova Senha</label>
                  <input 
                    type="password" 
                    required 
                    value={newPassword} 
                    onChange={(e) => setNewPassword(e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase mb-1">Confirmar Senha</label>
                  <input 
                    type="password" 
                    required 
                    value={confirmPassword} 
                    onChange={(e) => setConfirmPassword(e.target.value)} 
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" 
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
                    className="px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg disabled:opacity-50 hover:bg-primary-dark transition-colors"
                  >
                    {isChangingPassword ? 'Processando...' : 'Salvar Nova Senha'}
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
  return <DashboardLayout menuItems={menuItems}><Outlet /></DashboardLayout>;
}

export function HRLayout() {
  const [badges, setBadges] = useState({ triagem: 0, entrevistas: 0, mensagens: 0 });
  React.useEffect(() => {
    const fetchBadges = async () => {
      const { data } = await supabase.from('candidaturas').select('*');
      if (!data) return;
      let t = 0, e = 0, m = 0;
      data.forEach(d => {
        const fase = d.fase || 'Triagem';
        if (!d.visualizado && !d.status && (fase === 'Triagem' || fase === 'Prova')) t++;
        if (!d.visualizado && !d.status && ['Entrevista RH', 'Entrevista Gestor', 'Exame'].includes(fase)) e++;
        if (d.unread_messages_by_hr > 0) m += d.unread_messages_by_hr;
      });
      setBadges({ triagem: t, entrevistas: e, mensagens: m });
    };
    fetchBadges();
    const sub = supabase.channel('candidaturas_changes').on('postgres_changes', { event: '*', schema: 'public', table: 'candidaturas' }, fetchBadges).subscribe();
    return () => { sub.unsubscribe(); };
  }, []);

  const menuItems = [
    { to: '/rh', icon: Home, label: 'Dashboard RH' },
    { to: '/rh/vagas', icon: Briefcase, label: 'Gestão de Vagas' },
    { to: '/rh/candidatos', icon: Users, label: 'Candidatos', badge: badges.triagem },
    { to: '/rh/entrevistas', icon: Users, label: 'Entrevistas', badge: badges.entrevistas },
    { to: '/rh/mensagens', icon: MessageSquare, label: 'Mensagens', badge: badges.mensagens },
    { to: '/rh/provas', icon: CheckSquare, label: 'Provas' },
    { to: '/rh/talentos', icon: FileCheck, label: 'Banco de Talentos' },
    { to: '/rh/relatorios', icon: BarChart, label: 'Relatórios' },
  ];
  return <DashboardLayout menuItems={menuItems}><Outlet /></DashboardLayout>;
}

export function AdminLayout() {
  const menuItems = [
    { to: '/admin', icon: Home, label: 'Dashboard Admin' },
    { to: '/admin/users', icon: Users, label: 'Gestão de Usuários' },
    { to: '/admin/transferencias', icon: Repeat, label: 'Transferências' },
    { to: '/admin/auditoria', icon: Shield, label: 'Auditoria' },
    { to: '/admin/performance', icon: Activity, label: 'SRE' },
    { to: '/admin/configuracoes', icon: Settings, label: 'Configurações' },
  ];
  return <DashboardLayout menuItems={menuItems}><Outlet /></DashboardLayout>;
}