import React from "react";
import { Outlet, Link } from "react-router-dom";
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



export function PublicLayout() {
  const { branding } = useTenant();

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/">
            <Logo />
          </Link>
          <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
            <Link to="/" className="hover:text-primary transition-colors">
              Home
            </Link>
            <Link to="/vagas" className="hover:text-primary transition-colors">
              Vagas
            </Link>
            <Link to="/sobre" className="hover:text-primary transition-colors">
              Sobre Nós
            </Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
            >
              Login
            </Link>
            <Link
              to="/cadastro"
              className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-lg hover:bg-accent transition-colors"
            >
              Cadastre-se
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      <footer
        className="py-12"
        style={{
          backgroundColor: "var(--color-secondary)",
          color: "color-mix(in srgb, #ffffff 72%, transparent)",
        }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 pt-8 border-t border-white/20 text-sm text-center">
          © {new Date().getFullYear()} {branding.displayName}. Todos os direitos reservados.
        </div>
      </footer>
    </div>
  );
}

