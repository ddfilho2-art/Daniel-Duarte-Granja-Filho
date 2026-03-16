import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Briefcase, Users, FileText, MessageSquare, CheckSquare, 
  Settings, LogOut, Home, Search, User, FileCheck, Shield, BarChart
} from 'lucide-react';

const Logo = () => (
  <div className="flex items-center gap-2">
    <svg viewBox="0 0 600 100" className="h-10 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gradAI" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#00b4d8" />
          <stop offset="100%" stopColor="#001b54" />
        </linearGradient>
      </defs>

      {/* Symbol */}
      <g transform="translate(10, 5)">
        {/* Dark blue left */}
        <path d="M 25 20 L 5 50 L 15 75 L 35 45 Z" fill="#001b54" />
        {/* Cyan top right */}
        <path d="M 30 15 L 65 50 L 40 80 L 25 20 Z" fill="#00b4d8" />
        {/* Light blue bottom right */}
        <path d="M 15 80 L 35 110 L 65 60 L 40 85 Z" fill="#0077b6" />
      </g>

      {/* DFL Recruta */}
      <text x="95" y="70" fontFamily="Arial, sans-serif" fontWeight="900" fontStyle="italic" fontSize="56" fill="#001b54" letterSpacing="-2">DFL</text>
      
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

function SidebarItem({ to, icon: Icon, label }: { to: string, icon: any, label: string, key?: React.Key }) {
  const location = useLocation();
  const isBaseRoute = to === '/candidato' || to === '/rh' || to === '/admin';
  const isActive = isBaseRoute 
    ? location.pathname === to 
    : location.pathname === to || location.pathname.startsWith(to + '/');
  
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
        isActive 
          ? 'bg-primary/10 text-primary' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
    </Link>
  );
}

function DashboardLayout({ children, menuItems, userRole, userName }: { children: React.ReactNode, menuItems: { to: string, icon: any, label: string }[], userRole: string, userName: string }) {
  const location = useLocation();
  
  // Find the most specific matching menu item
  const currentMenuItem = [...menuItems].reverse().find(item => {
    const isBaseRoute = item.to === '/candidato' || item.to === '/rh' || item.to === '/admin';
    return isBaseRoute 
      ? location.pathname === item.to 
      : location.pathname === item.to || location.pathname.startsWith(item.to + '/');
  });

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
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
              {userName.charAt(0)}
            </div>
            <div>
              <p className="text-sm font-medium text-slate-900">{userName}</p>
              <p className="text-xs text-slate-500">{userRole}</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item, index) => (
            <SidebarItem key={index} to={item.to} icon={item.icon} label={item.label} />
          ))}
        </nav>

        <div className="p-4 border-t border-slate-200">
          <Link to="/login" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <LogOut className="w-5 h-5" />
            Sair
          </Link>
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
    <DashboardLayout menuItems={menuItems} userRole="Candidato" userName="João Silva">
      <Outlet />
    </DashboardLayout>
  );
}

export function HRLayout() {
  const menuItems = [
    { to: '/rh', icon: Home, label: 'Dashboard RH' },
    { to: '/rh/vagas', icon: Briefcase, label: 'Gestão de Vagas' },
    { to: '/rh/candidatos', icon: Users, label: 'Candidatos' },
    { to: '/rh/entrevistas', icon: Users, label: 'Entrevistas' },
    { to: '/rh/provas', icon: CheckSquare, label: 'Provas' },
    { to: '/rh/mensagens', icon: MessageSquare, label: 'Mensagens' },
    { to: '/rh/talentos', icon: FileCheck, label: 'Banco de Talentos' },
  ];

  return (
    <DashboardLayout menuItems={menuItems} userRole="Recursos Humanos" userName="Maria Oliveira">
      <Outlet />
    </DashboardLayout>
  );
}

export function AdminLayout() {
  const menuItems = [
    { to: '/admin', icon: Home, label: 'Dashboard Admin' },
    { to: '/admin/usuarios', icon: Users, label: 'Gestão de Usuários RH' },
    { to: '/admin/auditoria', icon: Shield, label: 'Auditoria' },
    { to: '/admin/indicadores', icon: BarChart, label: 'Indicadores Globais' },
  ];

  return (
    <DashboardLayout menuItems={menuItems} userRole="Administrador Master" userName="Admin Master">
      <Outlet />
    </DashboardLayout>
  );
}
