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
      .then(setTenants)
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
    if ((operation === "add" || operation === "replace") &&
        (!nome.trim() || !email.trim() || password.length < 8)) {
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
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Justificativa *
                </label>
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
                <button
                  type="button"
                  onClick={resetOperation}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 px-4 py-2 text-sm"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={submitOperation}
                  disabled={busy}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
                >
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
