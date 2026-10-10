import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, LoaderCircle, MessageCircle, Paperclip, Plus, RefreshCw, Send, X } from "lucide-react";
import { supabase } from "../lib/supabase";
import { useTenant } from "../contexts/TenantContext";
import {
  createTenantClinicConversation, getTenantClinicAttachmentUrl, listTenantClinicAttachments,
  listTenantClinicConversations, listTenantClinicMessages, sendTenantClinicMessage,
  uploadTenantClinicAttachment, type TenantClinicAttachment, type TenantClinicConversation,
  type TenantClinicMessage,
} from "../lib/tenant-clinic-chat";

type ContractOption = { id: string; clinic_tenant_id: string };
type JobOption = { id: string; titulo: string; status: string };

export function TenantClinicChat({ isClinic = false }: { isClinic?: boolean }) {
  const { tenant } = useTenant();
  const [conversations, setConversations] = useState<TenantClinicConversation[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [messages, setMessages] = useState<TenantClinicMessage[]>([]);
  const [attachments, setAttachments] = useState<TenantClinicAttachment[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [jobs, setJobs] = useState<JobOption[]>([]);
  const [contractId, setContractId] = useState("");
  const [jobId, setJobId] = useState("");
  const [subject, setSubject] = useState("");
  const [firstMessage, setFirstMessage] = useState("");
  const [draft, setDraft] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const selected = useMemo(() => conversations.find((item) => item.id === selectedId) || null, [conversations, selectedId]);

  const refreshConversations = useCallback(async (keepSelection = true) => {
    setLoading(true);
    setError("");
    try {
      const data = await listTenantClinicConversations();
      setConversations(data);
      if (!keepSelection || !data.some((item) => item.id === selectedId)) {
        setSelectedId(data[0]?.id || "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar as conversas.");
    } finally {
      setLoading(false);
    }
  }, [selectedId]);

  useEffect(() => { void refreshConversations(false); }, [refreshConversations]);

  useEffect(() => {
    if (isClinic || !tenant?.id) return;
    let active = true;
    const loadOptions = async () => {
      const [contractResult, jobResult] = await Promise.all([
        supabase.from("occupational_health_contracts")
          .select("id,clinic_tenant_id").eq("employer_tenant_id", tenant.id).eq("status", "active"),
        supabase.from("vagas").select("id,titulo,status")
          .in("status", ["Aberta", "aberta", "active", "ativo"]).order("titulo"),
      ]);
      if (!active) return;
      if (contractResult.error) {
        setError("Não foi possível carregar os contratos ativos de Saúde Ocupacional.");
      } else {
        setContracts((contractResult.data || []) as ContractOption[]);
        setContractId((contractResult.data || [])[0]?.id || "");
      }
      if (!jobResult.error) setJobs((jobResult.data || []) as JobOption[]);
    };
    void loadOptions();
    return () => { active = false; };
  }, [isClinic, tenant?.id]);

  const refreshThread = useCallback(async (id: string) => {
    if (!id) { setMessages([]); setAttachments([]); return; }
    try {
      const [messageData, attachmentData] = await Promise.all([
        listTenantClinicMessages(id), listTenantClinicAttachments(id),
      ]);
      setMessages(messageData);
      setAttachments(attachmentData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível carregar o histórico.");
    }
  }, []);

  useEffect(() => { void refreshThread(selectedId); }, [selectedId, refreshThread]);

  const createConversation = async (event: React.FormEvent) => {
    event.preventDefault();
    setSending(true); setError("");
    try {
      const id = await createTenantClinicConversation({
        contractId, subject, jobId: jobId || null, firstMessage,
      });
      setSubject(""); setFirstMessage(""); setJobId(""); setShowCreate(false);
      await refreshConversations(false);
      setSelectedId(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível abrir a conversa.");
    } finally { setSending(false); }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedId || !draft.trim()) return;
    setSending(true); setError("");
    try {
      await sendTenantClinicMessage(selectedId, draft);
      setDraft("");
      await Promise.all([refreshThread(selectedId), refreshConversations(true)]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível enviar a mensagem.");
    } finally { setSending(false); }
  };

  const uploadAttachment = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !selectedId) return;
    setUploading(true); setError("");
    try {
      await uploadTenantClinicAttachment(selectedId, file);
      await refreshThread(selectedId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível anexar o documento.");
    } finally { setUploading(false); }
  };

  const downloadAttachment = async (attachment: TenantClinicAttachment) => {
    try {
      const url = await getTenantClinicAttachmentUrl(selectedId, attachment.storage_path);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível baixar o anexo.");
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-teal-700">Canal entre tenants</p>
            <h1 className="text-2xl font-bold text-slate-900">Conversas com Saúde Ocupacional</h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              Comunicação operacional entre a empresa e a clínica contratada. O chat de candidatos permanece separado.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void refreshConversations(true)} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium text-slate-700">
              <RefreshCw className="h-4 w-4" /> Atualizar
            </button>
            {!isClinic && <button type="button" onClick={() => setShowCreate((v) => !v)} className="inline-flex items-center gap-2 rounded-lg bg-teal-700 px-3 py-2 text-sm font-semibold text-white">
              {showCreate ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />} Nova conversa
            </button>}
          </div>
        </header>

        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</div>}

        {showCreate && !isClinic && (
          <form onSubmit={createConversation} className="mb-5 grid gap-3 rounded-xl border bg-white p-4 shadow-sm md:grid-cols-2">
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Assunto
              <input required minLength={3} maxLength={180} value={subject} onChange={(e) => setSubject(e.target.value)} className="rounded-lg border px-3 py-2 font-normal" placeholder="Ex.: agendamento de exame admissional" />
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Contrato / clínica
              <select required value={contractId} onChange={(e) => setContractId(e.target.value)} className="rounded-lg border px-3 py-2 font-normal">
                <option value="">Selecione um contrato ativo</option>
                {contracts.map((c) => <option key={c.id} value={c.id}>Clínica vinculada · {c.clinic_tenant_id.slice(0, 8)}</option>)}
              </select>
              {contracts.length === 0 && <span className="text-xs font-normal text-amber-700">É necessário existir um contrato ativo com Saúde Ocupacional.</span>}
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700">
              Vaga relacionada (opcional)
              <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="rounded-lg border px-3 py-2 font-normal">
                <option value="">Sem vínculo com vaga</option>
                {jobs.map((j) => <option key={j.id} value={j.id}>{j.titulo}</option>)}
              </select>
            </label>
            <label className="grid gap-1 text-sm font-medium text-slate-700 md:col-span-2">
              Primeira mensagem
              <textarea value={firstMessage} onChange={(e) => setFirstMessage(e.target.value)} maxLength={4000} rows={3} className="rounded-lg border px-3 py-2 font-normal" placeholder="Descreva a solicitação operacional, sem incluir diagnóstico ou detalhes clínicos." />
            </label>
            <div className="flex justify-end md:col-span-2">
              <button disabled={sending || !contractId} className="rounded-lg bg-teal-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{sending ? "Criando..." : "Abrir conversa"}</button>
            </div>
          </form>
        )}

        <div className="grid min-h-[560px] gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-xl border bg-white">
            <div className="border-b px-4 py-3 font-semibold text-slate-800">Histórico</div>
            {loading ? <div className="flex items-center gap-2 p-5 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" /> Carregando...</div>
              : conversations.length === 0 ? <div className="p-5 text-sm text-slate-500">Nenhuma conversa registrada.</div>
              : <div className="max-h-[650px] overflow-y-auto">
                {conversations.map((conversation) => (
                  <button key={conversation.id} type="button" onClick={() => setSelectedId(conversation.id)} className={`block w-full border-b p-4 text-left hover:bg-slate-50 ${selectedId === conversation.id ? "bg-teal-50 border-l-4 border-l-teal-700" : ""}`}>
                    <span className="block truncate text-sm font-semibold text-slate-900">{conversation.subject}</span>
                    {conversation.job_title_snapshot && <span className="mt-1 block truncate text-xs text-slate-500">Vaga: {conversation.job_title_snapshot}</span>}
                    <span className="mt-2 block line-clamp-2 text-xs text-slate-600">{conversation.last_message || "Conversa aberta"}</span>
                    <span className="mt-2 block text-[11px] text-slate-400">{new Date(conversation.last_message_at).toLocaleString("pt-BR")}</span>
                  </button>
                ))}
              </div>}
          </aside>

          <section className="flex min-h-[560px] flex-col overflow-hidden rounded-xl border bg-white">
            {!selected ? <div className="flex flex-1 flex-col items-center justify-center p-8 text-center text-slate-500"><MessageCircle className="mb-3 h-10 w-10" /><p>Selecione uma conversa para visualizar o histórico.</p></div>
              : <>
                <div className="border-b px-5 py-4">
                  <h2 className="font-semibold text-slate-900">{selected.subject}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {selected.job_title_snapshot ? `Vaga relacionada: ${selected.job_title_snapshot} · ` : ""}Status: {selected.status === "open" ? "Aberta" : "Encerrada"}
                  </p>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto bg-slate-50 p-4">
                  {messages.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Ainda não há mensagens nesta conversa.</p>}
                  {messages.map((message) => {
                    const own = (isClinic && message.sender_side === "clinic") || (!isClinic && message.sender_side === "employer");
                    return <div key={message.id} className={`flex ${own ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${own ? "bg-teal-700 text-white" : "border bg-white text-slate-800"}`}>
                        <p className="whitespace-pre-wrap break-words text-sm">{message.body}</p>
                        <p className={`mt-2 text-right text-[10px] ${own ? "text-teal-100" : "text-slate-400"}`}>{message.sender_side === "clinic" ? "Saúde Ocupacional" : "Empresa"} · {new Date(message.created_at).toLocaleString("pt-BR")}</p>
                      </div>
                    </div>;
                  })}
                  {attachments.length > 0 && <div className="rounded-lg border bg-white p-3">
                    <p className="mb-2 text-xs font-semibold text-slate-700">Documentos anexados</p>
                    <div className="space-y-2">{attachments.map((attachment) => <div key={attachment.id} className="flex items-center justify-between gap-2 text-sm">
                      <span className="truncate text-slate-700">{attachment.original_name} <span className="text-xs text-slate-400">({Math.ceil(attachment.byte_size / 1024)} KB)</span></span>
                      <button type="button" onClick={() => void downloadAttachment(attachment)} className="inline-flex shrink-0 items-center gap-1 text-teal-700 hover:underline"><ArrowDownToLine className="h-4 w-4" /> Baixar</button>
                    </div>)}</div>
                  </div>}
                </div>
                <div className="border-t p-4">
                  <p className="mb-2 text-xs text-slate-500">Anexos: PDF, PNG ou JPEG até 10 MB. Envie apenas documentos ocupacionais necessários, como ASO; não inclua prontuários ou diagnósticos.</p>
                  <form onSubmit={sendMessage} className="flex items-end gap-2">
                    <label className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm text-slate-700 hover:bg-slate-50" title="Anexar documento">
                      {uploading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Paperclip className="h-4 w-4" />}
                      <span className="hidden sm:inline">{uploading ? "Enviando" : "Anexar"}</span>
                      <input type="file" accept="application/pdf,image/png,image/jpeg" disabled={uploading || selected.status !== "open"} onChange={(e) => void uploadAttachment(e)} className="hidden" />
                    </label>
                    <textarea value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={4000} rows={2} disabled={selected.status !== "open"} className="min-w-0 flex-1 resize-y rounded-lg border px-3 py-2 text-sm" placeholder="Digite uma mensagem operacional..." />
                    <button type="submit" disabled={sending || !draft.trim() || selected.status !== "open"} className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-700 px-4 text-sm font-semibold text-white disabled:opacity-50"><Send className="h-4 w-4" /><span className="hidden sm:inline">Enviar</span></button>
                  </form>
                </div>
              </>}
          </section>
        </div>
      </div>
    </main>
  );
}
