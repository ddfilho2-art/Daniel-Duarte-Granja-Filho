import React, { useState } from "react";
import {
  Outlet,
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Briefcase,
  Users,
  MessageSquare,
  CheckSquare,
  Settings,
  LogOut,
  Home,
  Search,
  User,
  FileCheck,
  Shield,
  BarChart,
  KeyRound,
  X,
  Activity,
  Repeat,
  Building2,
  Palette,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useUI } from "../../contexts/UIContext";
import { supabase } from "../../lib/supabase";
import { logAudit } from "../../lib/audit";
import { useTenant } from "../../contexts/TenantContext";
import DFLlogo from "../../assets/DFLlogo.svg";

const Logo = ({ variant = "primary" }: { variant?: "primary" | "light" }) => {
  const { branding } = useTenant();
  const tenantLogo =
    variant === "light"
      ? branding.logoLightUrl || branding.logoPrimaryUrl
      : branding.logoPrimaryUrl;

  return (
    <div className="flex min-w-0 items-center gap-2">
      <img
        src={tenantLogo || DFLlogo}
        alt={`Logo ${branding.displayName}`}
        className="h-10 max-w-44 object-contain"
      />
      {!tenantLogo && branding.displayName !== "DFL" && (
        <span className="truncate text-sm font-bold">{branding.displayName}</span>
      )}
    </div>
  );
};



function SidebarItem({
  to,
  icon: Icon,
  label,
  badge,
}: {
  to: string;
  icon: any;
  label: string;
  badge?: number;
}) {
  const location = useLocation();
  const isDashboardRoot =
    to === "/rh" || to === "/admin" || to === "/candidato";
  const isActive = isDashboardRoot
    ? location.pathname === to
    : location.pathname === to || location.pathname.startsWith(to + "/");

  return (
    <Link
      to={to}
      data-active={isActive}
      className="tenant-sidebar-link flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
    >
      <div className="flex items-center gap-3">
        <Icon className="w-5 h-5" />
        {label}
      </div>
    </Link>
  );
}

function DashboardLayout({
  children,
  menuItems,
}: {
  children?: React.ReactNode;
  menuItems: { to: string; icon: any; label: string; badge?: number }[];
}) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    user,
    profile,
    authLoading,
    profileLoading,
    isAuthenticated,
    signOut,
  } = useAuth();
  const { showPasswordModal, closeChangePassword } = useUI();

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [imgLoadError, setImgLoadError] = useState(false);

  React.useEffect(() => {
    if (!authLoading && !profileLoading && !isAuthenticated) {
      navigate("/login");
    }
  }, [isAuthenticated, authLoading, profileLoading, navigate]);

  React.useEffect(() => {
    setImgLoadError(false);
  }, [profile?.avatar_url, profile?.foto_url]);

  const handleLogout = async () => {
    try {
      await logAudit("Logout", "Autenticação", "Usuário encerrou a sessão.");
      await signOut();
      navigate("/login");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    setIsChangingPassword(true);
    setPasswordError("");
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      setPasswordSuccess("Senha alterada com sucesso!");
      setTimeout(() => {
        closeChangePassword();
        setPasswordSuccess("");
        setNewPassword("");
        setConfirmPassword("");
      }, 2000);
    } catch (err: any) {
      setPasswordError(err.message || "Erro ao alterar senha.");
    } finally {
      setIsChangingPassword(false);
    }
  };

  const userName =
    (profile as any)?.resume_data?.nome || profile?.nome || "Usuário";
  const userAvatar =
    profile?.avatar_url ??
    (profile as unknown as Record<string, string | undefined>)?.foto_url ??
    (profile as any)?.resume_data?.foto;

  const currentMenuItem = React.useMemo(
    () =>
      [...menuItems].reverse().find((item) => {
        const isDashboardRoot =
          item.to === "/rh" || item.to === "/admin" || item.to === "/candidato";
        return isDashboardRoot
          ? location.pathname === item.to
          : location.pathname === item.to ||
              location.pathname.startsWith(item.to + "/");
      }),
    [location.pathname, menuItems],
  );

  if (authLoading || profileLoading)
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-slate-50 flex">
      <aside className="tenant-sidebar w-64 border-r flex flex-col fixed h-full z-10">
        <div className="tenant-sidebar-border h-16 flex items-center px-6 border-b">
          <Link to="/">
            <Logo variant="light" />
          </Link>
        </div>

        <div className="tenant-sidebar-border p-4 border-t">
          <div className="flex items-center gap-3">
            {/* Avatar */}
            {userAvatar && !imgLoadError ? (
              <img
                key={userAvatar}
                src={userAvatar}
                alt="Avatar"
                className="w-10 h-10 rounded-full object-cover"
                onError={() => setImgLoadError(true)}
              />
            ) : (
              <div className="w-10 h-10 rounded-full bg-slate-300 flex items-center justify-center text-white font-semibold">
                {userName.charAt(0).toUpperCase()}
              </div>
            )}

            {/* Nome + Link */}
            <div className="flex flex-col">
              <span className="text-sm font-medium">
                {userName}
              </span>
              {profile?.perfil !== "Candidato" && (
                <Link
                  to={`/${location.pathname.split("/")[1] || "rh"}/perfil`}
                  className="tenant-sidebar-muted text-xs hover:underline"
                >
                  Meu Perfil
                </Link>
              )}
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <SidebarItem key={item.to} {...item} />
          ))}
        </nav>

        <div className="tenant-sidebar-border p-4 border-t space-y-2">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      <main className="flex-1 ml-64 flex flex-col min-h-screen">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-8 sticky top-0 z-10">
          <h1 className="text-lg font-medium text-slate-900">
            {currentMenuItem?.label || "Dashboard"}
          </h1>
        </header>

        <div className="flex-1 p-8">{children || <Outlet />}</div>
      </main>

      {showPasswordModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-[100] p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-[#0054A6]" />
                <h3 className="font-bold text-slate-900">Alterar Senha</h3>
              </div>
              <button
                onClick={closeChangePassword}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleChangePassword} className="p-6 space-y-4">
              {passwordError && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="w-1 h-1 bg-red-700 rounded-full" />
                  {passwordError}
                </div>
              )}
              {passwordSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 text-sm rounded-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200 text-center justify-center font-medium">
                  ✅ {passwordSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">
                  Nova Senha
                </label>
                <input
                  required
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0054A6]/20 outline-none transition-all"
                  placeholder="Mínimo 6 caracteres"
                  minLength={6}
                />
              </div>

              <div className="space-y-1">
                <label className="text-sm font-semibold text-slate-700">
                  Confirmar Nova Senha
                </label>
                <input
                  required
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-[#0054A6]/20 outline-none transition-all"
                  placeholder="Repita a nova senha"
                />
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-slate-100 mt-6">
                <button
                  type="button"
                  onClick={closeChangePassword}
                  className="px-6 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="px-6 py-2 text-sm font-bold bg-[#0054A6] text-white rounded-lg hover:bg-[#004080] transition-colors disabled:opacity-50 min-w-[120px]"
                >
                  {isChangingPassword ? "Alterando..." : "Salvar Senha"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export function CandidateLayout() {
  const menuItems = [
    { to: "/candidato", icon: Home, label: "Dashboard" },
    { to: "/candidato/curriculo", icon: User, label: "Meu Currículo" },
    { to: "/candidato/vagas", icon: Search, label: "Buscar Vagas" },
    {
      to: "/candidato/candidaturas",
      icon: Briefcase,
      label: "Minhas Candidaturas",
    },
    { to: "/candidato/mensagens", icon: MessageSquare, label: "Mensagens" },
  ];
  return <DashboardLayout menuItems={menuItems} />;
}

export function HRLayout() {
  const [badges, setBadges] = useState({
    triagem: 0,
    entrevistas: 0,
    mensagens: 0,
  });

  React.useEffect(() => {
    const fetchBadges = async () => {
      const { data, error } = await supabase.from("candidaturas").select("*");

      if (error) {
        console.error("Erro ao buscar badges:", error);
        return;
      }

      if (!data) return;

      let t = 0,
        e = 0,
        m = 0;

      data.forEach((d) => {
        const fase = d.fase || "Triagem";
        if (
          !d.visualizado &&
          !d.status &&
          (fase === "Triagem" || fase === "Prova")
        )
          t++;
        if (
          !d.visualizado &&
          !d.status &&
          ["Entrevista RH", "Entrevista Gestor", "Exame"].includes(fase)
        )
          e++;
        if (d.unread_messages_by_hr > 0) m += d.unread_messages_by_hr;
      });

      setBadges({ triagem: t, entrevistas: e, mensagens: m });
    };

    fetchBadges();

    const sub = supabase
      .channel("candidaturas_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "candidaturas" },
        fetchBadges,
      )
      .subscribe();

    return () => {
      sub.unsubscribe();
    };
  }, []);

  const menuItems = [
    { to: "/rh", icon: Home, label: "Dashboard RH" },
    { to: "/rh/vagas", icon: Briefcase, label: "Gestão de Vagas" },
    {
      to: "/rh/candidatos",
      icon: Users,
      label: "Triagem",
      badge: badges.triagem,
    },
    {
      to: "/rh/entrevistas",
      icon: Users,
      label: "Processo de Recrut / Selec.",
      badge: badges.entrevistas,
    },
    {
      to: "/rh/mensagens",
      icon: MessageSquare,
      label: "Mensagens",
      badge: badges.mensagens,
    },
    { to: "/rh/provas", icon: CheckSquare, label: "Provas" },
    { to: "/rh/talentos", icon: FileCheck, label: "Banco de Talentos" },
    { to: "/rh/relatorios", icon: BarChart, label: "Relatórios" },
  ];

  return <DashboardLayout menuItems={menuItems} />;
}

export function AdminLayout() {
  const menuItems = [
    { to: "/admin", icon: Home, label: "Dashboard Admin" },
    { to: "/admin/users", icon: Users, label: "Gestão de Usuários" },
    { to: "/admin/transferencias", icon: Repeat, label: "Transferências" },
    { to: "/admin/auditoria", icon: Shield, label: "Auditoria" },
    { to: "/admin/performance", icon: Activity, label: "SRE" },
    { to: "/admin/configuracoes", icon: Settings, label: "Configurações" },
  ];

  return <DashboardLayout menuItems={menuItems} />;
}

export function MasterLayout() {
  const menuItems = [
    { to: "/master", icon: Home, label: "Dashboard" },
    { to: "/master/tenants", icon: Building2, label: "Empresas" },
    { to: "/master/branding", icon: Palette, label: "Identidade Visual" },
  ];

  return <DashboardLayout menuItems={menuItems} />;
}
