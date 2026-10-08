import React, { useState, useEffect, useCallback } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Building2,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Palette,
  Eye,
} from "lucide-react";
import {
  listTenants,
  provisionTenant,
  suspendTenant,
  activateTenant,
  createBrandingDraft,
  publishBranding,
  getBrandingVersions,
  type TenantListItem,
  type ProvisionPayload,
  type BrandingDraftPayload,
} from "../lib/tenant-provisioning";

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function MasterDashboard() {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await listTenants();
      setTenants(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load tenants");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const active = tenants.filter((t) => t.status === "active").length;
  const suspended = tenants.filter((t) => t.status === "suspended").length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          Platform Master Admin
        </h1>
        <button
          onClick={fetchTenants}
          className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm hover:bg-slate-50"
        >
          <RefreshCw className="h-4 w-4" /> Atualizar
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total de Empresas" value={tenants.length} />
        <StatCard label="Ativas" value={active} color="text-green-600" />
        <StatCard label="Suspensas" value={suspended} color="text-amber-600" />
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4" /> {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="font-semibold text-slate-800">Empresas Recentes</h2>
        </div>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : tenants.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">
            Nenhuma empresa cadastrada ainda.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Empresa</th>
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Criada em</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.slice(0, 10).map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{t.display_name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{t.slug}</td>
                    <td className="px-4 py-2">{t.kind === "employer" ? "Empregador" : "Clínica"}</td>
                    <td className="px-4 py-2">
                      <StatusBadge status={t.status} />
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {new Date(t.created_at).toLocaleDateString("pt-BR")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tenant List & Management ──────────────────────────────────────────────────

export function MasterTenantList() {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(isTenantProvisionFormOpen);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setTenants(await listTenants());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const handleSuspend = async (id: string) => {
    if (!confirm("Suspender esta empresa? Os acessos serão bloqueados.")) return;
    setActionLoading(id);
    try {
      await suspendTenant(id);
      await fetchTenants();
    } catch (err) {
      alert("Erro: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  const handleActivate = async (id: string) => {
    setActionLoading(id);
    try {
      await activateTenant(id);
      await fetchTenants();
    } catch (err) {
      alert("Erro: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Gestão de Empresas</h1>
        <button
          onClick={() => {
            const next = !showForm;
            setShowForm(next);
            setTenantProvisionFormOpen(next);
          }}
          className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nova Empresa
        </button>
      </div>

      {showForm && (
        <TenantProvisionForm onCreated={() => { setShowForm(false); fetchTenants(); }} />
      )}

      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-2">Empresa</th>
                  <th className="px-4 py-2">CNPJ</th>
                  <th className="px-4 py-2">Slug</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {tenants.map((t) => (
                  <tr key={t.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-medium">{t.display_name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{t.cnpj}</td>
                    <td className="px-4 py-2 font-mono text-xs">{t.slug}</td>
                    <td className="px-4 py-2">{t.kind === "employer" ? "Empregador" : "Clínica"}</td>
                    <td className="px-4 py-2"><StatusBadge status={t.status} /></td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        {t.status === "active" ? (
                          <button
                            onClick={() => handleSuspend(t.id)}
                            disabled={actionLoading === t.id}
                            className="rounded px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          >
                            Suspender
                          </button>
                        ) : (
                          <button
                            onClick={() => handleActivate(t.id)}
                            disabled={actionLoading === t.id}
                            className="rounded px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            Reativar
                          </button>
                        )}
                        <a
                          href={`/empresa/${t.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded px-2 py-1 text-xs bg-slate-100 text-slate-600 hover:bg-slate-200"
                        >
                          <Eye className="h-3 w-3 inline mr-1" />Ver
                        </a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Provision Form ────────────────────────────────────────────────────────────

// Dados não sensíveis sobrevivem à navegação e até a uma atualização da página.
// A senha fica apenas em memória durante a navegação SPA e nunca é gravada no storage.
const TENANT_PROVISION_DRAFT_KEY = "recrutaai:master:tenant-provision-draft";
const TENANT_PROVISION_FORM_OPEN_KEY = "recrutaai:master:tenant-provision-form-open";
let tenantProvisionPasswordInMemory = "";

function isTenantProvisionFormOpen(): boolean {
  try {
    return sessionStorage.getItem(TENANT_PROVISION_FORM_OPEN_KEY) === "true";
  } catch {
    return false;
  }
}

function setTenantProvisionFormOpen(open: boolean) {
  try {
    if (open) {
      sessionStorage.setItem(TENANT_PROVISION_FORM_OPEN_KEY, "true");
    } else {
      sessionStorage.removeItem(TENANT_PROVISION_FORM_OPEN_KEY);
    }
  } catch {
    // O estado React continua funcionando durante a montagem atual.
  }
}

const emptyTenantProvisionForm = (): ProvisionPayload => ({
  kind: "employer",
  cnpj: "",
  legalName: "",
  displayName: "",
  slug: "",
  adminEmail: "",
  adminPassword: "",
});

function loadTenantProvisionDraft(): ProvisionPayload {
  const empty = emptyTenantProvisionForm();
  try {
    const saved = sessionStorage.getItem(TENANT_PROVISION_DRAFT_KEY);
    if (!saved) return { ...empty, adminPassword: tenantProvisionPasswordInMemory };
    const parsed = JSON.parse(saved) as Partial<ProvisionPayload>;
    return {
      ...empty,
      ...parsed,
      kind:
        parsed.kind === "occupational_health_provider" ? parsed.kind : "employer",
      adminPassword: tenantProvisionPasswordInMemory,
    };
  } catch {
    return { ...empty, adminPassword: tenantProvisionPasswordInMemory };
  }
}

function saveTenantProvisionDraft(form: ProvisionPayload) {
  tenantProvisionPasswordInMemory = form.adminPassword;
  try {
    sessionStorage.setItem(
      TENANT_PROVISION_DRAFT_KEY,
      JSON.stringify({
        kind: form.kind,
        cnpj: form.cnpj,
        legalName: form.legalName,
        displayName: form.displayName,
        slug: form.slug,
        adminEmail: form.adminEmail,
      }),
    );
  } catch {
    // O rascunho continua preservado em memória durante a navegação SPA.
  }
}

function clearTenantProvisionDraft() {
  tenantProvisionPasswordInMemory = "";
  setTenantProvisionFormOpen(false);
  try {
    sessionStorage.removeItem(TENANT_PROVISION_DRAFT_KEY);
  } catch {
    // O formulário ainda pode ser limpo mesmo se o storage estiver indisponível.
  }
}

function TenantProvisionForm({ onCreated }: { onCreated: () => void }) {
  const [form, setForm] = useState<ProvisionPayload>(loadTenantProvisionDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [slugError, setSlugError] = useState("");

  useEffect(() => {
    saveTenantProvisionDraft(form);
  }, [form]);

  const cancelForm = () => {
    clearTenantProvisionDraft();
    onCreated();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(form.slug)) {
      setError(
        "O slug deve ter 3 a 63 caracteres e usar somente letras minúsculas, números e hífen, sem hífen no início ou no fim.",
      );
      setLoading(false);
      return;
    }

    try {
      await provisionTenant(form);
      clearTenantProvisionDraft();
      setSuccess("Empresa provisionada com sucesso!");
      setTimeout(onCreated, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-6 space-y-4"
    >
      <h2 className="text-lg font-semibold text-slate-800">
        Provisionar Nova Empresa
      </h2>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <XCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField
          label="Tipo"
          value={form.kind}
          onChange={(v) => setForm({ ...form, kind: v as ProvisionPayload["kind"] })}
          type="select"
          options={[
            { value: "employer", label: "Empregador" },
            { value: "occupational_health_provider", label: "Clínica de Saúde Ocupacional" },
          ]}
        />
        <FormField
          label="CNPJ"
          value={form.cnpj}
          onChange={(v) => setForm({ ...form, cnpj: v })}
          placeholder="00.000.000/0000-00"
        />
        <FormField
          label="Razão Social"
          value={form.legalName}
          onChange={(v) => setForm({ ...form, legalName: v })}
        />
        <FormField
          label="Nome Fantasia"
          value={form.displayName}
          onChange={(v) => setForm({ ...form, displayName: v })}
        />
        <div>
          <FormField
            label="Slug da empresa"
            value={form.slug}
            onChange={(v) => {
              const slug = v.toLowerCase();
              setForm({ ...form, slug });
              setSlugError(
                slug && !/^[a-z0-9][a-z0-9-]{0,61}[a-z0-9]?$/.test(slug)
                  ? "Use somente letras minúsculas, números e hífen."
                  : "",
              );
            }}
            placeholder="empresa-x"
          />
          <p className="mt-1 text-xs text-slate-500">
            Informe apenas o identificador da empresa. Não digite
            <code className="mx-1 rounded bg-slate-100 px-1">https://</code>
            nem <code className="mx-1 rounded bg-slate-100 px-1">/</code>.
          </p>
          {slugError && (
            <p className="mt-1 text-xs text-red-600">{slugError}</p>
          )}
          <p className="mt-1 text-xs text-slate-600">
            URL:{" "}
            <code>{window.location.origin}/empresa/{form.slug || "empresa-x"}</code>
          </p>
        </div>
        <FormField
          label="E-mail do Admin"
          value={form.adminEmail}
          onChange={(v) => setForm({ ...form, adminEmail: v })}
          type="email"
        />
        <FormField
          label="Senha do Admin"
          value={form.adminPassword}
          onChange={(v) => setForm({ ...form, adminPassword: v })}
          type="password"
        />
      </div>

      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={cancelForm}
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-slate-50"
        >
          Cancelar
        </button>
        <button
          type="submit"
          disabled={loading || !!slugError}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {loading ? "Provisionando..." : "Provisionar"}
        </button>
      </div>
    </form>
  );
}

// ── Branding Editor ───────────────────────────────────────────────────────────

export function MasterBrandingEditor() {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [versions, setVersions] = useState<Record<string, unknown>[]>([]);
  const [theme, setTheme] = useState<BrandingDraftPayload>({});
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    listTenants().then(setTenants).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedTenant) {
      getBrandingVersions(selectedTenant)
        .then(setVersions)
        .catch(() => setVersions([]));
    }
  }, [selectedTenant]);

  const handleCreateDraft = async () => {
    if (!selectedTenant || !reason.trim()) {
      setError("Selecione uma empresa e informe o motivo.");
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const result = await createBrandingDraft(selectedTenant, theme, reason);
      setSuccess(`Draft v${result.version} criado com sucesso!`);
      const updated = await getBrandingVersions(selectedTenant);
      setVersions(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async (brandingId: string) => {
    if (!selectedTenant || !reason.trim()) {
      setError("Informe o motivo da publicação.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await publishBranding(selectedTenant, brandingId, reason);
      setSuccess("Tema publicado com sucesso!");
      const updated = await getBrandingVersions(selectedTenant);
      setVersions(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const colorFields: { key: keyof BrandingDraftPayload; label: string }[] = [
    { key: "sidebar_background", label: "Sidebar Fundo" },
    { key: "sidebar_text", label: "Sidebar Texto" },
    { key: "sidebar_active", label: "Sidebar Ativo" },
    { key: "sidebar_hover", label: "Sidebar Hover" },
    { key: "home_background", label: "Home Fundo" },
    { key: "hero_background", label: "Hero Fundo" },
    { key: "hero_text", label: "Hero Texto" },
    { key: "primary_action", label: "Ação Primária" },
    { key: "accent", label: "Destaque" },
    { key: "primary_color", label: "Cor Primária" },
    { key: "secondary_color", label: "Cor Secundária" },
    { key: "link_color", label: "Links" },
    { key: "focus_ring_color", label: "Foco" },
  ];

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Identidade Visual</h1>

      <div className="flex gap-4 items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Empresa
          </label>
          <select
            value={selectedTenant}
            onChange={(e) => setSelectedTenant(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {tenants.map((t) => (
              <option key={t.id} value={t.id}>
                {t.display_name} ({t.slug})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          <XCircle className="h-4 w-4" /> {error}
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </div>
      )}

      {selectedTenant && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
            <h2 className="text-lg font-semibold text-slate-800">
              <Palette className="inline h-5 w-5 mr-2" />
              Editor de Cores
            </h2>

            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {colorFields.map(({ key, label }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    {label}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(theme as Record<string, string>)[key] || "#000000"}
                      onChange={(e) =>
                        setTheme({ ...theme, [key]: e.target.value.toUpperCase() })
                      }
                      className="h-8 w-8 cursor-pointer rounded border border-slate-200"
                    />
                    <input
                      type="text"
                      value={(theme as Record<string, string>)[key] || ""}
                      onChange={(e) =>
                        setTheme({ ...theme, [key]: e.target.value.toUpperCase() })
                      }
                      placeholder="#000000"
                      className="flex-1 rounded border border-slate-200 px-2 py-1 text-xs font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Motivo da alteração
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ex: Atualização da identidade visual Q3"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="flex justify-end">
              <button
                onClick={handleCreateDraft}
                disabled={loading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Criar Draft"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3">
              <h2 className="font-semibold text-slate-800">Histórico de Versões</h2>
            </div>
            {versions.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Nenhuma versão encontrada.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-2">Versão</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2">Criado em</th>
                    <th className="px-4 py-2">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {versions.map((v) => (
                    <tr key={v.id as string} className="hover:bg-slate-50">
                      <td className="px-4 py-2 font-mono text-xs">v{v.version as number}</td>
                      <td className="px-4 py-2">
                        <StatusBadge status={v.status as string} />
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-500">
                        {new Date(v.created_at as string).toLocaleString("pt-BR")}
                      </td>
                      <td className="px-4 py-2">
                        {v.status === "draft" && (
                          <button
                            onClick={() => handlePublish(v.id as string)}
                            disabled={loading}
                            className="rounded px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            Publicar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ── Shared Components ─────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = "text-slate-900",
}: {
  label: string;
  value: number;
  color?: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: "bg-green-50 text-green-700",
    published: "bg-green-50 text-green-700",
    suspended: "bg-amber-50 text-amber-700",
    draft: "bg-slate-100 text-slate-600",
    archived: "bg-slate-100 text-slate-500",
  };
  const labels: Record<string, string> = {
    active: "Ativo",
    published: "Publicado",
    suspended: "Suspenso",
    draft: "Draft",
    archived: "Arquivado",
  };
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || "bg-slate-100 text-slate-600"}`}
    >
      {labels[status] || status}
    </span>
  );
}

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  options?: { value: string; label: string }[];
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">
        {label}
      </label>
      {type === "select" ? (
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          {options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          required
        />
      )}
    </div>
  );
}
