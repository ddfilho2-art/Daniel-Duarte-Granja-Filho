import React, { useEffect, useState } from "react";
import { AlertTriangle, Building2 } from "lucide-react";
import { listTenants, type TenantListItem } from "../lib/tenant-provisioning";
import { setSupabaseTenantId } from "../lib/supabase";
import { TenantPublicContent } from "./TenantPublicContent";

export function MasterTenantPublicContent() {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    listTenants()
      .then((items) => {
        if (!active) return;
        const eligible = items.filter((item) => item.kind === "employer" && (item.status === "active" || item.status === "configuring"));
        setTenants(eligible);
        if (eligible[0]) {
          setSupabaseTenantId(eligible[0].id);
          setSelectedId(eligible[0].id);
        }
      })
      .catch((loadError) => {
        if (active) setError(loadError instanceof Error ? loadError.message : "Não foi possível carregar as empresas.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      setSupabaseTenantId(null);
    };
  }, []);

  const selected = tenants.find((item) => item.id === selectedId) || null;
  const handleTenantChange = (tenantId: string) => {
    setSupabaseTenantId(tenantId || null);
    setSelectedId(tenantId);
  };

  return (
    <div className="space-y-5">
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-start gap-3">
          <Building2 className="mt-1 h-5 w-5 text-primary" />
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold text-slate-900">Conteúdo dos portais das empresas</h1>
            <p className="mt-1 text-sm text-slate-600">
              Escolha uma empresa empregadora para editar a mensagem da Home e a página Sobre Nós. As alterações ficam em rascunho até você publicar.
            </p>
            <label htmlFor="master-public-content-tenant" className="mt-4 block text-sm font-medium text-slate-700">Empresa</label>
            <select id="master-public-content-tenant" value={selectedId}
              onChange={(event) => handleTenantChange(event.target.value)}
              disabled={loading || tenants.length === 0}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 disabled:bg-slate-100 sm:max-w-xl">
              <option value="">{loading ? "Carregando empresas..." : "Selecione uma empresa"}</option>
              {tenants.map((item) => <option key={item.id} value={item.id}>{item.display_name} ({item.slug})</option>)}
            </select>
          </div>
        </div>
        {error && <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
        {!loading && tenants.length === 0 && !error && <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">Não há empresas empregadoras ativas para configurar. Cadastre ou reative uma empresa na seção Empresas.</p>}
      </section>
      {selected && <TenantPublicContent key={selected.id} masterTenant={{ id: selected.id, kind: selected.kind, displayName: selected.display_name, status: selected.status }} />}
    </div>
  );
}
