import React, { useEffect, useState } from "react";
import { Clock, CheckCircle2, AlertCircle, Mail, RefreshCw } from "lucide-react";
import { supabase } from "../lib/supabase";
import { safeFetch } from "../lib/api";
import { useTenant } from "../contexts/TenantContext";

export function EmailOperations() {
  const { tenant } = useTenant();
  const [emailQueue, setEmailQueue] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [emailSummary, setEmailSummary] = useState({ pending: 0, sent: 0, failed: 0 });
  const [activeSubTab, setActiveSubTab] = useState<"queue" | "history">(
    "queue",
  );

  async function fetchEmailQueue() {
    try {
      if (!tenant?.id) throw new Error("Empresa não identificada. Entre pelo portal da empresa.");
      setLoadingEmails(true);
      setErrorMessage(null);
      setEmailQueue([]);
      setEmailLogs([]);
      setEmailSummary({ pending: 0, sent: 0, failed: 0 });

      const queueResponse = await safeFetch("/api/email-monitor", { headers: { "X-Tenant-Id": tenant.id } });
      if (!queueResponse.ok) {
        throw new Error(
          queueResponse.data?.message ||
            queueResponse.data?.code ||
            "Não foi possível carregar a fila de e-mails.",
        );
      }
      setEmailQueue(queueResponse.data?.queue || []);
      setEmailSummary(queueResponse.data?.summary || { pending: 0, sent: 0, failed: 0 });

      const { data: logData, error: logError } = await supabase
        .from("logs")
        .select("*")
        .or("acao.eq.Enviou Convite,acao.eq.Enviou Mensagem Talentos")
        .eq("tenant_id", tenant.id)
        .order("data", { ascending: false })
        .limit(20);

      if (logError) throw logError;
      setEmailLogs(logData || []);
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
      setErrorMessage(err instanceof Error ? err.message : "Não foi possível carregar a operação de e-mails.");
    } finally {
      setLoadingEmails(false);
    }
  }

  useEffect(() => {
    fetchEmailQueue();
    const interval = setInterval(fetchEmailQueue, 15000);
    return () => clearInterval(interval);
  }, [tenant?.id]);

  async function handleRetry() {
    try {
      if (!tenant?.id) throw new Error("Empresa não identificada. Entre pelo portal da empresa.");
      setLoadingEmails(true);
      setErrorMessage(null);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const response = await safeFetch("/api/retry-emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "X-Tenant-Id": tenant.id },
      });
      if (!response.ok) {
        throw new Error(
          response.data?.message ||
            response.data?.code ||
            "Não foi possível reprocessar os e-mails.",
        );
      }

      const result = response.data;
      alert(
        `✅ ${result?.processed || 0} e-mails processados. Sucesso: ${result?.successCount || 0}, Falhas: ${result?.failCount || 0}`,
      );
      await fetchEmailQueue();
    } catch (e: any) {
      console.error("Erro ao reprocessar:", e);
      setErrorMessage(e instanceof Error ? e.message : "Não foi possível reprocessar os e-mails.");
    } finally {
      setLoadingEmails(false);
    }
  }

  const pendingCount = emailSummary.pending;
  const sentCount = emailSummary.sent;
  const failedCount = emailSummary.failed;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-400">
      <div className="p-6 border-b border-slate-200 bg-slate-50 rounded-t-xl">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Operação de E-mails — {tenant?.displayName || "Empresa"}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Acompanhe e reprocesse e-mails parados ou falhos na fila.
        </p>
      </div>

      {errorMessage && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{errorMessage}</div>}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-amber-600" />
            <div>
              <p className="text-sm font-medium text-amber-800">Pendentes</p>
              <p className="text-3xl font-bold text-amber-600">
                {pendingCount}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            <div>
              <p className="text-sm font-medium text-emerald-800">Enviados</p>
              <p className="text-3xl font-bold text-emerald-600">{sentCount}</p>
            </div>
          </div>
        </div>

        <div className="bg-red-50 border border-red-200 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-8 h-8 text-red-600" />
            <div>
              <p className="text-sm font-medium text-red-800">Falhas</p>
              <p className="text-3xl font-bold text-red-600">{failedCount}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button
          onClick={handleRetry}
          disabled={loadingEmails}
          className="flex items-center gap-2 bg-[#0054A6] text-white px-6 py-3 rounded-xl text-sm font-bold hover:bg-[#004080] transition-all disabled:opacity-50"
        >
          <RefreshCw
            className={`w-5 h-5 ${loadingEmails ? "animate-spin" : ""}`}
          />
          Reprocessar E-mails com Falha
        </button>

        <button
          onClick={fetchEmailQueue}
          disabled={loadingEmails}
          className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 px-6 py-3 rounded-xl text-sm font-bold hover:bg-slate-50 transition-all"
        >
          <RefreshCw
            className={`w-5 h-5 ${loadingEmails ? "animate-spin" : ""}`}
          />
          Atualizar
        </button>
      </div>

      <div className="flex gap-2 p-1 bg-slate-100 rounded-xl w-fit">
        <button
          onClick={() => setActiveSubTab("queue")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${
            activeSubTab === "queue"
              ? "bg-white text-[#0054A6] shadow-sm"
              : "text-slate-500"
          }`}
        >
          Fila ({emailQueue.length})
        </button>
        <button
          onClick={() => setActiveSubTab("history")}
          className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${
            activeSubTab === "history"
              ? "bg-white text-[#0054A6] shadow-sm"
              : "text-slate-500"
          }`}
        >
          Histórico ({emailLogs.length})
        </button>
      </div>

      {activeSubTab === "queue" ? (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loadingEmails ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">Carregando...</p>
            </div>
          ) : emailQueue.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">Fila vazia</p>
              <p className="text-xs text-slate-400 mt-1">
                Nenhum e-mail pendente
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 font-bold uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3">Destinatário</th>
                    <th className="px-6 py-3">Status</th>
                    <th className="px-6 py-3 text-center">Tentativas</th>
                    <th className="px-6 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {emailQueue.map((item: any) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3">{item.payload?.to || "N/A"}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-bold ${
                            item.status === "sent"
                              ? "bg-emerald-100 text-emerald-700"
                              : item.status === "failed"
                                ? "bg-red-100 text-red-700"
                                : "bg-amber-100 text-amber-700"
                          }`}
                        >
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-center">{item.attempts}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {loadingEmails ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">Carregando histórico...</p>
            </div>
          ) : emailLogs.length === 0 ? (
            <div className="p-12 text-center">
              <Mail className="w-8 h-8 text-slate-300 mx-auto mb-3" />
              <p className="text-sm text-slate-500 font-medium">
                Nenhum histórico ainda
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Os logs de e-mails aparecerão aqui
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-50 font-bold uppercase text-xs">
                  <tr>
                    <th className="px-6 py-3">Ação</th>
                    <th className="px-6 py-3">Detalhes</th>
                    <th className="px-6 py-3">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {emailLogs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="px-6 py-3 font-medium">{log.acao}</td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {typeof log.detalhes === "string"
                          ? log.detalhes.slice(0, 80)
                          : JSON.stringify(log.detalhes).slice(0, 80)}
                      </td>
                      <td className="px-6 py-3 text-xs text-slate-500">
                        {new Date(log.data).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
