import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.tsx";
import { TenantProvider } from "./contexts/TenantContext";
import { resolveTenantRoute } from "./lib/tenant-routing";
import "./index.css";

const tenantRoute = resolveTenantRoute(window.location.pathname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter basename={tenantRoute.basename}>
      <TenantProvider slug={tenantRoute.slug}>
        <App />
      </TenantProvider>
    </BrowserRouter>
  </StrictMode>,
);
