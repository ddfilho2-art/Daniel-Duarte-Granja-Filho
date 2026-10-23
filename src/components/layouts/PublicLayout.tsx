import React from "react";
import { Outlet, Link } from "react-router-dom";
import { useTenant } from "../../contexts/TenantContext";

function Brand() {
  const { branding, tenant, isTenantRoute } = useTenant();

  if (!isTenantRoute) {
    return (
      <img
        src="/logo.png"
        alt="Recruta AÍ"
        className="h-11 w-auto max-w-44 object-contain"
      />
    );
  }

  const companyName = tenant?.displayName || branding.displayName;
  const companyLogo = branding.logoPrimaryUrl;

  return (
    <div className="flex min-w-0 flex-col items-start justify-center gap-0.5">
      {companyLogo ? (
        <img
          src={companyLogo}
          alt={`Logo ${companyName}`}
          className="h-7 max-w-36 object-contain"
        />
      ) : (
        <span className="max-w-40 truncate text-sm font-bold text-slate-800">
          {companyName}
        </span>
      )}
      <img
        src="/logo.png"
        alt="Recruta AÍ"
        className="h-3.5 w-auto max-w-20 object-contain object-left"
      />
    </div>
  );
}

export function PublicLayout() {
  const { branding, tenant, isTenantRoute } = useTenant();
  const allowCandidateSignup =
    isTenantRoute &&
    tenant?.kind === "employer" &&
    tenant.candidateSignupEnabled !== false;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 min-h-16 py-2 flex items-center justify-between gap-4">
          <Link to="/" aria-label={isTenantRoute ? `Portal de ${tenant?.displayName || branding.displayName}` : "Recruta AÍ"}>
            <Brand />
          </Link>

          {isTenantRoute && (
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
          )}

          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm font-medium text-slate-600 hover:text-primary transition-colors"
            >
              Login
            </Link>
            {allowCandidateSignup && (
              <Link
                to="/cadastro"
                className="text-sm font-medium bg-primary text-white px-4 py-2 rounded-lg hover:bg-accent transition-colors"
              >
                Cadastre-se
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="flex-1">
        <Outlet />
      </main>
      {isTenantRoute && (
        <footer
          className="py-8"
          style={{
            backgroundColor: "var(--color-secondary)",
            color: "color-mix(in srgb, #ffffff 72%, transparent)",
          }}
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 border-t border-white/20 text-sm text-center">
            © {new Date().getFullYear()} {branding.displayName}. Todos os direitos reservados.
          </div>
        </footer>
      )}
    </div>
  );
}
