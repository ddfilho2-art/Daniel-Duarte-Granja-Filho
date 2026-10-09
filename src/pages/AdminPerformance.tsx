import React from "react";
import { EmailOperations } from "../components/EmailOperations";
import { useAuth } from "../contexts/AuthContext";
import { useTenant } from "../contexts/TenantContext";

export function AdminPerformance() {
  const { loading: authLoading, canAdministerTenant, hasTenantAccess, isPlatformMasterAdmin } = useAuth();
  const { tenant, isTenantRoute, loading: tenantLoading } = useTenant();

  if (authLoading || tenantLoading) {
    return <div className="m-6 rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Validando acesso à empresa...</div>;
  }
  if (!isTenantRoute || !tenant || !hasTenantAccess || !canAdministerTenant || isPlatformMasterAdmin) {
    return <div role="alert" className="m-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">A operação de e-mails está disponível somente para administradores autorizados da empresa.</div>;
  }
  return <div className="container mx-auto px-4 py-8"><EmailOperations /></div>;
}
