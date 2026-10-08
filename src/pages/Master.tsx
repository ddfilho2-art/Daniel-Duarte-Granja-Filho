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
  endTenantContract,
  createBrandingDraft,
  publishBranding,
  getBrandingVersions,
  type TenantListItem,
  type ProvisionPayload,
  type BrandingDraftPayload,
} from "../lib/tenant-provisioning";
import { supabase } from "../lib/supabase";
import {
  listTenantAdmins,
  listTenantAdminHistory,
  addTenantAdmin,
  replaceTenantAdmin,
  revokeTenantAdmin,
  createTenantAdminAttachment,
  listTenantAdminAttachments,
  createTenantAdminAttachmentSignedUrl,
  type TenantAdmin,
  type TenantAdminOperation,
  type AdminAttachment,
} from "../lib/tenant-admin-management";

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
  const handleEndContract = async (id: string) => {
    if (!confirm("Encerrar o contrato desta empresa? O acesso será bloqueado imediatamente e a empresa permanecerá no histórico.")) return;
    setActionLoading(id);
    try {
      await endTenantContract(id);
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
                  <th className="px-4 py-2">Criação</th>
                  <th className="px-4 py-2">Encerramento do contrato</th>
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
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {t.created_at ? new Date(t.created_at).toLocaleDateString("pt-BR") : "-"}
                    </td>
                    <td className="px-4 py-2 text-xs text-slate-500">
                      {t.contract_ended_at ? new Date(t.contract_ended_at).toLocaleDateString("pt-BR") : "-"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex gap-2">
                        {t.status === "active" && (
                          <button
                            onClick={() => handleSuspend(t.id)}
                            disabled={actionLoading === t.id}
                            className="rounded px-2 py-1 text-xs bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                          >
                            Suspender
                          </button>
                        )}
                        {t.status === "suspended" && (
                          <button
                            onClick={() => handleActivate(t.id)}
                            disabled={actionLoading === t.id}
                            className="rounded px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50"
                          >
                            Reativar
                          </button>
                        )}
                        {t.status !== "archived" && (
                          <button
                            onClick={() => handleEndContract(t.id)}
                            disabled={actionLoading === t.id}
                            className="rounded px-2 py-1 text-xs bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Encerrar contrato
                          </button>
                        )}
                        <a
                          href={`/master/administradores?tenant=${t.id}`}
                          className="rounded px-2 py-1 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100"
                        >
                          Administradores
                        </a>
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

function isTenantProvisionFormOpen(): boolean {
  try {
    return sessionStorage.getItem(TENANT_PROVISION_FORM_OPEN_KEY) === "true";
  } catch {
    return false;
  }
}

function setTenantProvisionFormOpen(open: boolean) {
  try {
    if (open) sessionStorage.setItem(TENANT_PROVISION_FORM_OPEN_KEY, "true");
    else sessionStorage.removeItem(TENANT_PROVISION_FORM_OPEN_KEY);
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
});

function loadTenantProvisionDraft(): ProvisionPayload {
  const empty = emptyTenantProvisionForm();
  try {
    const saved = sessionStorage.getItem(TENANT_PROVISION_DRAFT_KEY);
    if (!saved) return empty;
    const parsed = JSON.parse(saved) as Partial<ProvisionPayload>;
    return {
      ...empty,
      ...parsed,
      kind:
        parsed.kind === "occupational_health_provider" ? parsed.kind : "employer",
    };
  } catch {
    return empty;
  }
}

function saveTenantProvisionDraft(form: ProvisionPayload) {
  try {
    sessionStorage.setItem(
      TENANT_PROVISION_DRAFT_KEY,
      JSON.stringify({
        kind: form.kind,
        cnpj: form.cnpj,
        legalName: form.legalName,
        displayName: form.displayName,
        slug: form.slug,
      }),
    );
  } catch {
    // O rascunho continua preservado durante a navegação SPA.
  }
}

function clearTenantProvisionDraft() {
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
      setSuccess(
        "Empresa criada em configuração. Agora cadastre o primeiro administrador na seção Administradores das Empresas.",
      );
      setTimeout(onCreated, 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="rounded-xl border border-slate-200 bg-white p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Nova Empresa</h2>
        <p className="mt-1 text-sm text-slate-500">
          Cadastre somente os dados da empresa. O primeiro administrador será incluído separadamente.
        </p>
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
          {slugError && <p className="mt-1 text-xs text-red-600">{slugError}</p>}
          <p className="mt-1 text-xs text-slate-600">
            URL: <code>{window.location.origin}/empresa/{form.slug || "empresa-x"}</code>
          </p>
        </div>
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
          {loading ? "Criando..." : "Criar Empresa"}
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
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedColor, setSelectedColor] = useState<keyof BrandingDraftPayload>("sidebar_background");

  useEffect(() => {
    listTenants().then(setTenants).catch((err) =>
      setError(err instanceof Error ? err.message : "Não foi possível carregar as empresas."),
    );
  }, []);

  useEffect(() => {
    if (!selectedTenant) {
      setVersions([]);
      return;
    }
    getBrandingVersions(selectedTenant)
      .then(setVersions)
      .catch((err) => setError(err instanceof Error ? err.message : "Não foi possível carregar o histórico."));
  }, [selectedTenant]);

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview("");
      return;
    }
    const url = URL.createObjectURL(logoFile);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logoFile]);

  const colorFields: { key: keyof BrandingDraftPayload; label: string; help: string; sample: "sidebar" | "text" | "active" | "hover" | "page" | "hero" | "heroText" | "button" | "accent" | "primary" | "secondary" | "link" | "focus" }[] = [
    { key: "sidebar_background", label: "Fundo do menu lateral", help: "A faixa vertical que contém os menus.", sample: "sidebar" },
    { key: "sidebar_text", label: "Texto do menu", help: "A cor dos nomes das opções do menu.", sample: "text" },
    { key: "sidebar_active", label: "Opção selecionada", help: "O fundo do menu que indica a página atual.", sample: "active" },
    { key: "sidebar_hover", label: "Ao passar o mouse", help: "O fundo de uma opção quando o mouse está sobre ela.", sample: "hover" },
    { key: "home_background", label: "Fundo da página", help: "A cor de fundo da área principal.", sample: "page" },
    { key: "hero_background", label: "Banner principal", help: "O fundo da área de destaque do portal da empresa.", sample: "hero" },
    { key: "hero_text", label: "Texto do banner", help: "A cor do texto sobre o banner principal.", sample: "heroText" },
    { key: "primary_action", label: "Botões principais", help: "A cor de botões como candidatar-se ou salvar.", sample: "button" },
    { key: "accent", label: "Destaques", help: "Elementos que precisam chamar a atenção.", sample: "accent" },
    { key: "primary_color", label: "Cor principal", help: "A cor institucional usada em elementos importantes.", sample: "primary" },
    { key: "secondary_color", label: "Cor secundária", help: "A segunda cor institucional do portal.", sample: "secondary" },
    { key: "link_color", label: "Links", help: "A cor de textos clicáveis.", sample: "link" },
    { key: "focus_ring_color", label: "Realce de campos", help: "A borda que indica o campo atualmente selecionado.", sample: "focus" },
  ];

  const handleCreateDraft = async () => {
    if (!selectedTenant || !reason.trim()) {
      setError("Selecione uma empresa e informe o motivo da alteração.");
      return;
    }
    if (logoFile && (!["image/png", "image/jpeg", "image/webp"].includes(logoFile.type) || logoFile.size > 2 * 1024 * 1024)) {
      setError("Use um logo PNG, JPG ou WebP de até 2 MB.");
      return;
    }

    setLoading(true);
    setError("");
    setSuccess("");
    try {
      let draftTheme: BrandingDraftPayload = { ...theme };
      if (logoFile) {
        const extension = logoFile.type === "image/png" ? "png" : logoFile.type === "image/webp" ? "webp" : "jpg";
        const storagePath = `${selectedTenant}/logo-primary-${Date.now()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("tenant-branding")
          .upload(storagePath, logoFile, { upsert: true, contentType: logoFile.type });
        if (uploadError) throw new Error("Não foi possível enviar o logo: " + uploadError.message);
        draftTheme = { ...draftTheme, logo_primary_path: storagePath } as BrandingDraftPayload;
      }
      const result = await createBrandingDraft(selectedTenant, draftTheme, reason.trim());
      setSuccess(`Rascunho da identidade visual v${result.version ?? ""} criado. Revise a prévia e publique no histórico quando estiver pronto.`);
      setLogoFile(null);
      setReason("");
      setVersions(await getBrandingVersions(selectedTenant));
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
    setSuccess("");
    try {
      await publishBranding(selectedTenant, brandingId, reason.trim());
      setSuccess("Identidade visual publicada com sucesso.");
      setVersions(await getBrandingVersions(selectedTenant));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const colorValue = (key: keyof BrandingDraftPayload, fallback: string) =>
    String(theme[key] || fallback);
  const selectedField = colorFields.find((field) => field.key === selectedColor) || colorFields[0];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Identidade Visual</h1>
        <p className="mt-1 text-sm text-slate-600">Personalize a aparência de cada empresa e veja onde cada mudança será aplicada.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
        <select value={selectedTenant} onChange={(e) => { setSelectedTenant(e.target.value); setTheme({}); setLogoFile(null); }}
          className="w-full max-w-2xl rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="">Selecione uma empresa...</option>
          {tenants.map((t) => <option key={t.id} value={t.id}>{t.display_name} ({t.slug})</option>)}
        </select>
        <p className="mt-2 text-xs text-slate-500">As alterações ficam separadas por empresa. Você poderá revisar cada rascunho antes de publicar.</p>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"><XCircle className="inline h-4 w-4 mr-2" />{error}</div>}
      {success && <div role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700"><CheckCircle2 className="inline h-4 w-4 mr-2" />{success}</div>}

      {selectedTenant && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-800">Logotipo da empresa</h2>
            <p className="text-sm text-slate-600">O logo da empresa aparece no topo do portal. A marca Recruta AÍ ficará menor logo abaixo, identificando a plataforma.</p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700">Escolha o arquivo do logo</label>
                <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                  className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2" />
                <p className="text-xs text-slate-500">PNG, JPG ou WebP; até 2 MB. O envio cria um rascunho, não publica automaticamente.</p>
                {logoFile && <button type="button" onClick={() => setLogoFile(null)} className="text-sm text-red-700 underline">Remover arquivo selecionado</button>}
              </div>
              <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-center">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-3">Prévia da marca</p>
                {logoPreview ? <img src={logoPreview} alt="Prévia do logo da empresa" className="mx-auto max-h-20 max-w-full object-contain" /> : <div className="py-5 text-sm text-slate-400">O logo escolhido aparecerá aqui.</div>}
                <div className="mt-3 border-t border-slate-200 pt-3">
                  <img src="/logo.png" alt="Recruta AÍ" className="mx-auto h-7 max-w-36 object-contain" />
                  <p className="mt-1 text-xs text-slate-500">Recruta AÍ — plataforma de recrutamento</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5">
            <h2 className="text-lg font-semibold text-slate-800"><Palette className="inline h-5 w-5 mr-2" />Aparência do portal</h2>
            <p className="text-sm text-slate-600">Selecione uma área abaixo. A prévia destacará onde a cor será aplicada.</p>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="space-y-2">
                {colorFields.map(({ key, label, help }) => (
                  <button key={key} type="button" onClick={() => setSelectedColor(key)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${selectedColor === key ? "border-blue-500 bg-blue-50 ring-1 ring-blue-200" : "border-slate-200 hover:bg-slate-50"}`}>
                    <span className="block text-sm font-medium text-slate-800">{label}</span>
                    <span className="block text-xs text-slate-500 mt-1">{help}</span>
                  </button>
                ))}
              </div>
              <div className="space-y-4">
                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                  <div className="bg-slate-100 px-4 py-2 text-xs text-slate-600">Prévia ilustrativa do portal</div>
                  <div className="flex min-h-64">
                    <aside className="w-2/5 p-3 space-y-3" style={{ backgroundColor: colorValue("sidebar_background", "#27336D"), color: colorValue("sidebar_text", "#FFFFFF"), outline: ["sidebar_background","sidebar_text"].includes(selectedColor) ? "3px solid #F59E0B" : undefined }}>
                      <div className="rounded-md p-2 text-xs font-semibold" style={{ backgroundColor: colorValue("sidebar_active", "#0054A6"), outline: selectedColor === "sidebar_active" ? "3px solid #F59E0B" : undefined }}>Empresas</div>
                      <div className="rounded-md p-2 text-xs" style={{ backgroundColor: selectedColor === "sidebar_hover" ? colorValue("sidebar_hover", "#33417E") : "transparent", outline: selectedColor === "sidebar_hover" ? "3px solid #F59E0B" : undefined }}>Administradores</div>
                      <div className="text-xs">Identidade Visual</div>
                    </aside>
                    <section className="flex-1 p-3 space-y-3" style={{ backgroundColor: colorValue("home_background", "#F8FAFC"), outline: selectedColor === "home_background" ? "3px solid #F59E0B" : undefined }}>
                      <div className="rounded-md p-3" style={{ backgroundColor: colorValue("hero_background", "#0054A6"), color: colorValue("hero_text", "#FFFFFF"), outline: ["hero_background","hero_text"].includes(selectedColor) ? "3px solid #F59E0B" : undefined }}>
                        <p className="text-xs font-semibold">Oportunidades para sua equipe</p>
                        <p className="text-[10px] mt-1">Banner principal do portal</p>
                      </div>
                      <button type="button" className="rounded-md px-3 py-2 text-xs font-medium text-white" style={{ backgroundColor: colorValue("primary_action", "#00A859"), outline: selectedColor === "primary_action" ? "3px solid #F59E0B" : undefined }}>Botão principal</button>
                      <p className="text-xs" style={{ color: colorValue("link_color", "#0054A6"), outline: selectedColor === "link_color" ? "2px solid #F59E0B" : undefined }}>Link de exemplo</p>
                      <div className="rounded-md border p-2 text-xs" style={{ borderColor: colorValue("focus_ring_color", "#38BDF8"), outline: selectedColor === "focus_ring_color" ? "3px solid #F59E0B" : undefined }}>Campo selecionado</div>
                      <div className="flex gap-2">
                        <span className="h-5 w-5 rounded-full" title="Destaque" style={{ backgroundColor: colorValue("accent", "#0054A6"), outline: selectedColor === "accent" ? "3px solid #F59E0B" : undefined }} />
                        <span className="h-5 w-5 rounded-full" title="Cor principal" style={{ backgroundColor: colorValue("primary_color", "#0054A6"), outline: selectedColor === "primary_color" ? "3px solid #F59E0B" : undefined }} />
                        <span className="h-5 w-5 rounded-full" title="Cor secundária" style={{ backgroundColor: colorValue("secondary_color", "#27336D"), outline: selectedColor === "secondary_color" ? "3px solid #F59E0B" : undefined }} />
                      </div>
                    </section>
                  </div>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">Área selecionada: {selectedField.label}</p>
                  <p className="mt-1 text-sm text-slate-600">{selectedField.help} A borda laranja mostra a região relacionada na prévia.</p>
                </div>
                <div className="rounded-lg border border-slate-200 p-4 space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Escolha a cor</label>
                  <div className="flex items-center gap-3">
                    <input aria-label={selectedField.label} type="color" value={colorValue(selectedColor, "#0054A6")}
                      onChange={(e) => setTheme({ ...theme, [selectedColor]: e.target.value.toUpperCase() })}
                      className="h-10 w-12 cursor-pointer rounded border border-slate-200" />
                    <input aria-label={`Código da cor para ${selectedField.label}`} type="text" value={String(theme[selectedColor] || "")}
                      onChange={(e) => setTheme({ ...theme, [selectedColor]: e.target.value.toUpperCase() })}
                      placeholder="#0054A6" pattern="^#[0-9A-Fa-f]{6}$"
                      className="w-36 rounded border border-slate-200 px-3 py-2 text-sm font-mono" />
                    <span className="text-xs text-slate-500">Cor atual: {colorValue(selectedColor, "#0054A6")}</span>
                  </div>
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Por que deseja alterar?</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} maxLength={500}
                placeholder="Ex.: atualizar as cores para combinar com a marca da empresa."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <p className="mt-1 text-xs text-slate-500">Obrigatório para manter o histórico da alteração.</p>
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleCreateDraft} disabled={loading || !reason.trim()}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50">
                {loading ? "Salvando..." : "Salvar como rascunho"}
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-4 py-3"><h2 className="font-semibold text-slate-800">Histórico e publicação</h2></div>
            {versions.length === 0 ? <p className="p-6 text-sm text-slate-500">Nenhuma versão encontrada.</p> : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500"><tr><th className="px-4 py-2">Versão</th><th className="px-4 py-2">Status</th><th className="px-4 py-2">Criada em</th><th className="px-4 py-2">Ações</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {versions.map((v) => <tr key={v.id as string} className="hover:bg-slate-50">
                    <td className="px-4 py-2 font-mono text-xs">v{v.version as number}</td>
                    <td className="px-4 py-2"><StatusBadge status={v.status as string} /></td>
                    <td className="px-4 py-2 text-xs text-slate-500">{new Date(v.created_at as string).toLocaleString("pt-BR")}</td>
                    <td className="px-4 py-2">{v.status === "draft" && <button type="button" onClick={() => handlePublish(v.id as string)} disabled={loading || !reason.trim()} className="rounded px-2 py-1 text-xs bg-green-50 text-green-700 hover:bg-green-100 disabled:opacity-50">Publicar</button>}</td>
                  </tr>)}
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
    configuring: "Em configuração",
    archived: "Contrato encerrado",
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


export function MasterTenantAdminManagement() {
  const [tenants, setTenants] = useState<TenantListItem[]>([]);
  const [selectedTenant, setSelectedTenant] = useState("");
  const [admins, setAdmins] = useState<TenantAdmin[]>([]);
  const [history, setHistory] = useState<TenantAdminOperation[]>([]);
  const [attachments, setAttachments] = useState<Record<string, AdminAttachment[]>>({});
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [operation, setOperation] = useState<"add" | "replace" | "revoke" | null>(null);
  const [targetAdmin, setTargetAdmin] = useState("");
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [justification, setJustification] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);

  const resetOperation = () => {
    setOperation(null);
    setTargetAdmin("");
    setNome("");
    setEmail("");
    setPassword("");
    setEffectiveDate(new Date().toISOString().slice(0, 10));
    setJustification("");
    setAttachment(null);
  };

  const load = useCallback(async () => {
    if (!selectedTenant) {
      setAdmins([]);
      setHistory([]);
      setAttachments({});
      return;
    }
    setLoading(true);
    setError("");
    try {
      const [current, events] = await Promise.all([
        listTenantAdmins(selectedTenant),
        listTenantAdminHistory(selectedTenant),
      ]);
      setAdmins(current);
      setHistory(events);
      const pairs = await Promise.all(
        events.map(async (event) => {
          try {
            return [event.id, await listTenantAdminAttachments(event.id)] as const;
          } catch {
            return [event.id, []] as const;
          }
        }),
      );
      setAttachments(Object.fromEntries(pairs));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [selectedTenant]);

  useEffect(() => {
    listTenants()
      .then((items) => {
        setTenants(items);
        const requestedTenant = new URLSearchParams(window.location.search).get("tenant");
        if (requestedTenant && items.some((tenant) => tenant.id === requestedTenant)) {
          setSelectedTenant(requestedTenant);
        }
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitOperation = async () => {
    if (!selectedTenant || !operation) return;
    const reason = justification.trim();

    if (reason.length < 5) {
      setError("Informe a justificativa da operação.");
      return;
    }
    if ((operation === "replace" || operation === "revoke") && !targetAdmin) {
      setError("Selecione o administrador atual.");
      return;
    }
    if (
      (operation === "add" || operation === "replace") &&
      (!nome.trim() || !email.trim() || password.length < 8)
    ) {
      setError("Informe nome, e-mail e uma senha de pelo menos 8 caracteres.");
      return;
    }
    if (attachment && attachment.size > 10 * 1024 * 1024) {
      setError("O anexo deve ter no máximo 10 MB.");
      return;
    }

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const effectiveAt = new Date(effectiveDate + "T12:00:00").toISOString();
      let result: { operation_id: string };

      if (operation === "add") {
        result = await addTenantAdmin({
          tenantId: selectedTenant,
          nome: nome.trim(),
          email: email.trim(),
          password,
          effectiveAt,
          justification: reason,
        });
      } else if (operation === "replace") {
        result = await replaceTenantAdmin({
          tenantId: selectedTenant,
          previousUserId: targetAdmin,
          nome: nome.trim(),
          email: email.trim(),
          password,
          effectiveAt,
          justification: reason,
        });
      } else {
        result = await revokeTenantAdmin({
          tenantId: selectedTenant,
          userId: targetAdmin,
          effectiveAt,
          justification: reason,
        });
      }

      if (attachment) {
        try {
          await createTenantAdminAttachment(selectedTenant, result.operation_id, attachment);
        } catch (attachmentError) {
          setError(
            "Operação concluída, mas o anexo falhou: " +
              (attachmentError instanceof Error ? attachmentError.message : String(attachmentError)),
          );
        }
      }

      await load();
      setSuccess(
        operation === "add"
          ? "Administrador adicionado com sucesso."
          : operation === "replace"
            ? "Administrador trocado com sucesso."
            : "Administrador revogado com sucesso.",
      );
      resetOperation();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const opLabel = (type: TenantAdminOperation["operation_type"]) =>
    type === "add" ? "Adição" : type === "replace" ? "Troca" : "Revogação";

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Administradores das Empresas</h1>
          <p className="mt-1 text-sm text-slate-500">
            Gestão, substituição, revogação e histórico dos administradores por empresa.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          disabled={!selectedTenant || loading}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:opacity-50"
        >
          Atualizar
        </button>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <label className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
        <select
          value={selectedTenant}
          onChange={(e) => setSelectedTenant(e.target.value)}
          className="w-full max-w-2xl rounded-lg border border-slate-200 px-3 py-2 text-sm"
        >
          <option value="">Selecione uma empresa...</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.display_name} ({tenant.slug})
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          {success}
        </div>
      )}

      {selectedTenant && (
        <>
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-slate-800">Administradores atuais</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Empresas ativas não podem ficar sem administrador ativo.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOperation("add")}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white"
              >
                Adicionar administrador
              </button>
            </div>

            {loading ? (
              <div className="p-8 text-center text-sm text-slate-500">Carregando...</div>
            ) : admins.length === 0 ? (
              <div className="p-6 text-sm text-amber-700 bg-amber-50">
                Nenhum administrador ativo encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Administrador</th>
                      <th className="px-5 py-3">E-mail</th>
                      <th className="px-5 py-3">Início</th>
                      <th className="px-5 py-3">Status</th>
                      <th className="px-5 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {admins.map((admin) => (
                      <tr key={admin.id}>
                        <td className="px-5 py-3 font-medium">{admin.user?.nome || "Usuário removido"}</td>
                        <td className="px-5 py-3">{admin.user?.email || "-"}</td>
                        <td className="px-5 py-3 text-xs">
                          {admin.activated_at ? new Date(admin.activated_at).toLocaleDateString("pt-BR") : "-"}
                        </td>
                        <td className="px-5 py-3"><StatusBadge status={admin.status} /></td>
                        <td className="px-5 py-3">
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => { setOperation("replace"); setTargetAdmin(admin.user_id); }}
                              className="rounded px-2 py-1 text-xs bg-blue-50 text-blue-700"
                            >
                              Trocar
                            </button>
                            <button
                              type="button"
                              onClick={() => { setOperation("revoke"); setTargetAdmin(admin.user_id); }}
                              className="rounded px-2 py-1 text-xs bg-red-50 text-red-700"
                            >
                              Revogar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="border-b border-slate-200 px-5 py-4">
              <h2 className="font-semibold text-slate-800">Histórico</h2>
            </div>
            {history.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">Nenhuma operação registrada.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-5 py-3">Operação</th>
                      <th className="px-5 py-3">Administrador</th>
                      <th className="px-5 py-3">Anterior</th>
                      <th className="px-5 py-3">Data efetiva</th>
                      <th className="px-5 py-3">Justificativa</th>
                      <th className="px-5 py-3">Anexos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {history.map((item) => (
                      <tr key={item.id} className="align-top">
                        <td className="px-5 py-3 font-medium">{opLabel(item.operation_type)}</td>
                        <td className="px-5 py-3">{item.target_user?.nome || "Administrador removido"}</td>
                        <td className="px-5 py-3">{item.previous_user?.nome || "-"}</td>
                        <td className="px-5 py-3 text-xs">
                          {new Date(item.effective_at).toLocaleDateString("pt-BR")}
                          <div className="text-slate-400">{new Date(item.created_at).toLocaleString("pt-BR")}</div>
                        </td>
                        <td className="px-5 py-3 max-w-md">{item.justification}</td>
                        <td className="px-5 py-3">
                          {(attachments[item.id] || []).map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              className="block text-xs text-blue-700 hover:underline"
                              onClick={async () => {
                                try {
                                  const url = await createTenantAdminAttachmentSignedUrl(file.storage_path);
                                  window.open(url, "_blank", "noopener,noreferrer");
                                } catch (err) {
                                  setError(err instanceof Error ? err.message : String(err));
                                }
                              }}
                            >
                              {file.file_name}
                            </button>
                          ))}
                          {!attachments[item.id]?.length && <span className="text-xs text-slate-400">-</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {operation && selectedTenant && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 p-4 flex items-center justify-center">
          <div className="w-full max-w-2xl rounded-xl bg-white shadow-xl">
            <div className="border-b border-slate-200 px-5 py-4 flex items-center justify-between">
              <h2 className="font-semibold text-slate-900">
                {operation === "add" ? "Adicionar administrador" : operation === "replace" ? "Trocar administrador" : "Revogar administrador"}
              </h2>
              <button type="button" onClick={resetOperation} className="text-slate-500">Fechar</button>
            </div>

            <div className="p-5 space-y-4">
              {(operation === "replace" || operation === "revoke") && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Administrador atual</label>
                  <select
                    value={targetAdmin}
                    onChange={(e) => setTargetAdmin(e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    <option value="">Selecione...</option>
                    {admins.map((admin) => (
                      <option key={admin.user_id} value={admin.user_id}>
                        {admin.user?.nome || admin.user?.email || admin.user_id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(operation === "add" || operation === "replace") && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <FormField label="Nome" value={nome} onChange={setNome} />
                  <FormField label="E-mail" value={email} onChange={setEmail} type="email" />
                  <FormField label="Senha inicial" value={password} onChange={setPassword} type="password" />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data efetiva</label>
                <input
                  type="date"
                  value={effectiveDate}
                  onChange={(e) => setEffectiveDate(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Justificativa *</label>
                <textarea
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Informe o motivo da operação."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Anexo opcional</label>
                <input
                  type="file"
                  onChange={(e) => setAttachment(e.target.files?.[0] || null)}
                  className="w-full text-sm"
                />
                <p className="mt-1 text-xs text-slate-500">Máximo: 10 MB.</p>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                <button type="button" onClick={resetOperation} disabled={busy} className="rounded-lg border border-slate-200 px-4 py-2 text-sm">
                  Cancelar
                </button>
                <button type="button" onClick={submitOperation} disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
                  {busy ? "Processando..." : "Confirmar"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
