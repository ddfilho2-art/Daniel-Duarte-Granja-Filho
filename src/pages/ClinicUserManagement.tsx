import React, { useCallback, useEffect, useState } from "react";
import { ArrowLeft, LoaderCircle, RefreshCw, ShieldCheck, UserPlus, UserRoundCog } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "../lib/supabase";

type ClinicTenant = { tenant_id: string; tenant_name: string };
type ClinicUser = {
  id: string; user_id: string; status: "active" | "suspended" | "invited" | "revoked";
  created_at: string; activated_at: string | null; user: { id: string; nome: string; email: string; login: string; status: string } | null;
};

export function ClinicUserManagement() {
  const [tenants, setTenants] = useState<ClinicTenant[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [users, setUsers] = useState<ClinicUser[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [calendarId, setCalendarId] = useState("");
  const [calendarTimezone, setCalendarTimezone] = useState("America/Sao_Paulo");
  const [calendarSaving, setCalendarSaving] = useState(false);

  const invoke = async (body: Record<string, unknown>) => {
    const { data, error: invokeError } = await supabase.functions.invoke("clinic-user-management", { body });
    if (invokeError || !data?.success) {
      const code = String(data?.code || invokeError?.message || "OPERATION_FAILED");
      const friendly: Record<string, string> = {
        CLINIC_ADMIN_REQUIRED: "Seu usuário não possui permissão de administrador desta clínica.",
        EMAIL_ALREADY_REGISTERED: "Este e-mail já está cadastrado na plataforma.",
        INVALID_PASSWORD_POLICY: "A senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.",
        INVALID_USER_DATA: "Confira nome, e-mail e senha informados.",
      };
      throw new Error(friendly[code] || "Não foi possível concluir a operação. Confira as permissões e tente novamente.");
    }
    return data;
  };

  const loadUsers = useCallback(async (id: string) => {
    if (!id) { setUsers([]); setLoading(false); return; }
    setLoading(true); setError("");
    try {
      const data = await invoke({ action: "list", tenantId: id });
      setUsers((data.users || []) as ClinicUser[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar os usuários.");
      setUsers([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    let active = true;
    const loadTenants = async () => {
      setLoading(true);
      const { data, error: rpcError } = await supabase.rpc("list_my_clinic_admin_tenants");
      if (!active) return;
      if (rpcError) {
        setError("Não foi possível identificar as clínicas que você administra.");
        setLoading(false);
        return;
      }
      const items = (data || []) as ClinicTenant[];
      setTenants(items);
      setTenantId(items[0]?.tenant_id || "");
      if (!items.length) {
        setError("A gestão de usuários está disponível somente para administradores do tenant de Saúde Ocupacional.");
        setLoading(false);
      }
    };
    void loadTenants();
    return () => { active = false; };
  }, []);

  useEffect(() => { if (tenantId) void loadUsers(tenantId); }, [tenantId, loadUsers]);

  useEffect(() => {
    let active = true;
    const loadCalendar = async () => {
      if (!tenantId) return;
      const { data, error: rpcError } = await supabase.rpc("get_my_clinic_calendar_integration", { p_tenant_id: tenantId });
      if (!active) return;
      if (rpcError) { setError("Não foi possível carregar a configuração do Google Calendar."); return; }
      const config = Array.isArray(data) ? data[0] : data;
      setCalendarId(config?.calendar_id || "");
      setCalendarTimezone(config?.timezone || "America/Sao_Paulo");
    };
    void loadCalendar();
    return () => { active = false; };
  }, [tenantId]);

  const saveCalendar = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: calendarTimezone.trim() }).format(new Date());
    } catch {
      setError("Informe um fuso horário IANA válido, por exemplo America/Sao_Paulo.");
      return;
    }
    setCalendarSaving(true); setError(""); setNotice("");
    const { error: rpcError } = await supabase.rpc("save_my_clinic_calendar_integration", {
      p_tenant_id: tenantId, p_calendar_id: calendarId.trim(), p_timezone: calendarTimezone.trim(),
    });
    if (rpcError?.message?.includes("calendar_has_active_appointments")) {
      setError("Não é possível trocar o ID do calendário enquanto existem agendamentos ativos. Cancele ou conclua os agendamentos antes de mudar o calendário.");
    } else if (rpcError) setError("Não foi possível salvar o calendário. Confira o ID do calendário e o fuso horário.");
    else setNotice("Calendário da clínica salvo. A integração também exige credenciais OAuth configuradas nos secrets do Supabase.");
    setCalendarSaving(false);
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!tenantId) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await invoke({ action: "create", tenantId, name, email, password });
      setName(""); setEmail(""); setPassword("");
      setNotice("Usuário criado e vinculado à clínica.");
      await loadUsers(tenantId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível criar o usuário.");
    } finally { setSaving(false); }
  };

  const changeStatus = async (user: ClinicUser) => {
    const next = user.status === "active" ? "suspended" : "active";
    if (!window.confirm(next === "suspended" ? "Deseja inativar este usuário nesta clínica?" : "Deseja reativar este usuário nesta clínica?")) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await invoke({ action: "set_status", tenantId, userId: user.user_id, status: next });
      setNotice(next === "active" ? "Usuário reativado." : "Usuário inativado.");
      await loadUsers(tenantId);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível alterar o status."); }
    finally { setSaving(false); }
  };

  const resetPassword = async (user: ClinicUser) => {
    const next = window.prompt("Nova senha (mínimo 8 caracteres, com maiúscula, minúscula e número):");
    if (!next) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await invoke({ action: "reset_password", tenantId, userId: user.user_id, password: next });
      setNotice("Senha redefinida. Informe a nova senha ao usuário por um canal seguro.");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível redefinir a senha."); }
    finally { setSaving(false); }
  };

  const changeEmail = async (user: ClinicUser) => {
    const next = window.prompt("Novo e-mail de login:", user.user?.email || "");
    if (!next || next.trim().toLowerCase() === user.user?.email?.toLowerCase()) return;
    setSaving(true); setError(""); setNotice("");
    try {
      await invoke({ action: "update_email", tenantId, userId: user.user_id, email: next.trim() });
      setNotice("E-mail de login atualizado.");
      await loadUsers(tenantId);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível atualizar o e-mail."); }
    finally { setSaving(false); }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link to="/saude-ocupacional" className="mb-3 inline-flex items-center gap-2 text-sm font-medium text-teal-800 hover:underline"><ArrowLeft className="h-4 w-4" /> Voltar ao portal clínico</Link>
            <h1 className="text-2xl font-bold text-slate-900">Gestão de Usuários</h1>
            <p className="mt-1 text-sm text-slate-600">Gerencie somente os usuários vinculados ao tenant de Saúde Ocupacional selecionado.</p>
          </div>
          <button type="button" onClick={() => void loadUsers(tenantId)} disabled={!tenantId || loading} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium"><RefreshCw className="h-4 w-4" /> Atualizar</button>
        </header>

        {tenants.length > 1 && <label className="mb-5 grid max-w-xl gap-1 text-sm font-medium text-slate-700">Clínica
          <select value={tenantId} onChange={(e) => setTenantId(e.target.value)} className="rounded-lg border bg-white px-3 py-2">{tenants.map((t) => <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>)}</select>
        </label>}
        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}
        {notice && <div role="status" className="mb-4 rounded-lg border border-teal-200 bg-teal-50 p-3 text-sm text-teal-800">{notice}</div>}

        {tenantId && <form onSubmit={saveCalendar} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-3">
          <div className="flex items-center gap-2 md:col-span-3"><ShieldCheck className="h-5 w-5 text-teal-700" /><h2 className="font-semibold text-slate-900">Integração Google Calendar</h2></div>
          <label className="grid gap-1 text-sm text-slate-700">ID do calendário corporativo<input required minLength={3} maxLength={500} value={calendarId} onChange={(e) => setCalendarId(e.target.value)} className="rounded-lg border px-3 py-2" placeholder="ID em Configurações do Google Calendar" /></label>
          <label className="grid gap-1 text-sm text-slate-700">Fuso horário<input required value={calendarTimezone} onChange={(e) => setCalendarTimezone(e.target.value)} className="rounded-lg border px-3 py-2" placeholder="America/Sao_Paulo" /></label>
          <div className="flex items-end"><button disabled={calendarSaving} className="w-full rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{calendarSaving ? "Salvando..." : "Salvar calendário"}</button></div>
          <p className="text-xs text-slate-500 md:col-span-3">As credenciais OAuth (client ID, client secret e refresh token) devem ser configuradas como secrets da Edge Function no Supabase. Não informe senhas nem tokens aqui.</p>
        </form>}

        {tenantId && <form onSubmit={createUser} className="mb-6 grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-4">
          <div className="flex items-center gap-2 md:col-span-4"><UserPlus className="h-5 w-5 text-teal-700" /><h2 className="font-semibold text-slate-900">Adicionar usuário da clínica</h2></div>
          <label className="grid gap-1 text-sm text-slate-700">Nome<input required minLength={2} maxLength={160} value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-1 text-sm text-slate-700">E-mail de login<input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-lg border px-3 py-2" /></label>
          <label className="grid gap-1 text-sm text-slate-700">Senha inicial<input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className="rounded-lg border px-3 py-2" /><span className="text-xs text-slate-500">8+ caracteres, maiúscula, minúscula e número.</span></label>
          <div className="flex items-end"><button disabled={saving} className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-teal-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Criar usuário</button></div>
        </form>}

        <section className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b px-4 py-3"><UserRoundCog className="h-5 w-5 text-teal-700" /><h2 className="font-semibold text-slate-900">Usuários vinculados</h2><span className="ml-auto text-xs text-slate-500">{users.length} usuário(s)</span></div>
          {loading ? <div className="flex items-center justify-center gap-2 p-10 text-sm text-slate-500"><LoaderCircle className="h-5 w-5 animate-spin" /> Carregando...</div>
            : users.length === 0 ? <div className="p-8 text-center text-sm text-slate-500">Nenhum usuário cadastrado para esta clínica.</div>
            : <div className="overflow-x-auto"><table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Criado em</th><th className="px-4 py-3">Ações</th></tr></thead>
              <tbody>{users.map((user) => <tr key={user.id} className="border-t">
                <td className="px-4 py-3"><p className="font-medium text-slate-900">{user.user?.nome || "Usuário"}</p><p className="text-xs text-slate-500">{user.user?.email || "—"}</p></td>
                <td className="px-4 py-3"><span className={"rounded-full px-2 py-1 text-xs " + (user.status === "active" ? "bg-teal-50 text-teal-800" : "bg-slate-100 text-slate-700")}>{user.status === "active" ? "Ativo" : user.status === "suspended" ? "Inativo" : user.status}</span></td>
                <td className="px-4 py-3 text-slate-600">{new Date(user.created_at).toLocaleDateString("pt-BR")}</td>
                <td className="px-4 py-3"><div className="flex flex-wrap gap-3"><button type="button" disabled={saving} onClick={() => void changeStatus(user)} className="font-medium text-teal-700 hover:underline">{user.status === "active" ? "Inativar" : "Ativar"}</button><button type="button" disabled={saving} onClick={() => void changeEmail(user)} className="font-medium text-slate-700 hover:underline">Alterar e-mail</button><button type="button" disabled={saving} onClick={() => void resetPassword(user)} className="font-medium text-slate-700 hover:underline">Redefinir senha</button></div></td>
              </tr>)}</tbody>
            </table></div>}
        </section>
        <p className="mt-4 flex items-start gap-2 text-xs text-slate-500"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /> A administração é limitada aos usuários vinculados à clínica selecionada. O histórico de operações administrativas é registrado para auditoria.</p>
      </div>
    </main>
  );
}
