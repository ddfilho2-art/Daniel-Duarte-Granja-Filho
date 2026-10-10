import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Download,
  FileText,
  LoaderCircle,
  Paperclip,
  Upload,
  X,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { Link } from "react-router-dom";
import {
  uploadMedicalAttachment,
  getMedicalAttachmentUrl,
  listReferralAttachments,
  type AttachmentInfo,
} from "../lib/medical-attachments";

type ReferralStatus =
  | "referred"
  | "scheduled"
  | "attended"
  | "result_reported"
  | "completed";
type FitnessResult = "pending" | "fit" | "unfit" | "inconclusive";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(1)} MB`;
}

type Referral = {
  id: string;
  candidate_name: string;
  candidate_email: string;
  job_title: string;
  exam_type: string;
  status: ReferralStatus;
  fitness_result: FitnessResult;
  scheduled_for: string | null;
  scheduled_location: string | null;
  updated_at: string;
};

const statusLabel: Record<ReferralStatus, string> = {
  referred: "Encaminhado",
  scheduled: "Agendado",
  attended: "Atendido",
  result_reported: "Resultado informado",
  completed: "Concluído",
};

const examLabel: Record<string, string> = {
  admission: "Admissional",
  dismissal: "Demissional",
  periodic: "Periódico",
  return_to_work: "Retorno ao trabalho",
  role_change: "Mudança de função",
  other: "Outro",
};

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
    : "Não agendado";
}

/* ── Attachment panel (inline per referral row) ───────────────────────── */
function ReferralAttachments({ referralId }: { referralId: string }) {
  const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [downloadingPath, setDownloadingPath] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const list = await listReferralAttachments(referralId);
      setAttachments(list);
    } catch {
      setError("Não foi possível carregar os anexos.");
    }
    setLoading(false);
  }, [referralId]);

  useEffect(() => { void reload(); }, [reload]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadMedicalAttachment(referralId, file);
      await reload();
    } catch (err: any) {
      setError(err.message || "Falha no upload.");
    }
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDownload = async (storagePath: string, originalName: string) => {
    setDownloadingPath(storagePath);
    setError(null);
    try {
      const url = await getMedicalAttachmentUrl(referralId, storagePath);
      const a = document.createElement("a");
      a.href = url;
      a.download = originalName;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err: any) {
      setError(err.message || "Não foi possível gerar o link de download.");
    }
    setDownloadingPath(null);
  };

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
          <Paperclip className="h-3.5 w-3.5" /> Anexos ({attachments.length})
        </span>
        <label className="cursor-pointer rounded bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50">
          {uploading ? "Enviando…" : "Enviar arquivo"}
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            className="hidden"
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
      </div>

      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}

      {loading ? (
        <p className="text-xs text-slate-500">Carregando anexos…</p>
      ) : attachments.length === 0 ? (
        <p className="text-xs text-slate-400">Nenhum anexo ainda.</p>
      ) : (
        <ul className="space-y-1.5">
          {attachments.map((att) => (
            <li
              key={att.id}
              className="flex items-center justify-between gap-2 rounded bg-white px-2.5 py-1.5 text-xs shadow-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <FileText className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                <span className="truncate font-medium text-slate-700">
                  {att.original_name}
                </span>
                <span className="shrink-0 text-slate-400">
                  {formatBytes(att.byte_size)}
                </span>
                <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                  {att.sender_side === "employer" ? "Empregador" : "Clínica"}
                </span>
              </div>
              <button
                disabled={downloadingPath === att.storage_path}
                onClick={() =>
                  void handleDownload(att.storage_path, att.original_name)
                }
                className="flex shrink-0 items-center gap-1 rounded border border-slate-200 px-2 py-0.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                <Download className="h-3 w-3" />
                {downloadingPath === att.storage_path ? "…" : "Baixar"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ── Single referral table row with expandable attachments ────────────── */
function ReferralRow({
  referral,
  savingId,
  expanded,
  onToggleExpand,
  onUpdate,
}: {
  referral: Referral;
  savingId: string | null;
  expanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (
    r: Referral,
    s: ReferralStatus,
    fit?: FitnessResult,
  ) => Promise<void>;
}) {
  const isSaving = savingId === referral.id;

  return (
    <>
      <tr className="border-t border-slate-100 align-top">
        <td className="p-4">
          <button
            onClick={onToggleExpand}
            title={expanded ? "Recolher anexos" : "Expandir anexos"}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <Paperclip className="h-4 w-4" />
          </button>
        </td>
        <td className="p-4 font-medium text-slate-900">
          {referral.candidate_name}
          <span className="mt-1 block font-normal text-slate-500">
            {referral.candidate_email}
          </span>
        </td>
        <td className="p-4">
          <span className="block">
            {examLabel[referral.exam_type] || referral.exam_type}
          </span>
          <span className="mt-1 block text-slate-500">{referral.job_title}</span>
        </td>
        <td className="p-4 text-slate-600">
          {formatDate(referral.scheduled_for)}
          {referral.scheduled_location && (
            <span className="mt-1 block text-xs">
              {referral.scheduled_location}
            </span>
          )}
        </td>
        <td className="p-4">
          <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700">
            {statusLabel[referral.status]}
          </span>
          {referral.fitness_result !== "pending" && (
            <span className="ml-2 text-xs font-medium text-slate-600">
              {referral.fitness_result === "fit"
                ? "Apto"
                : referral.fitness_result === "unfit"
                ? "Inapto"
                : "Inconclusivo"}
            </span>
          )}
        </td>
        <td className="p-4">
          <div className="flex flex-wrap gap-2">
            {referral.status === "referred" && (
              <button
                disabled={isSaving}
                onClick={() => void onUpdate(referral, "scheduled")}
                className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
              >
                Agendar
              </button>
            )}
            {referral.status === "scheduled" && (
              <button
                disabled={isSaving}
                onClick={() => void onUpdate(referral, "attended")}
                className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
              >
                Registrar atendimento
              </button>
            )}
            {referral.status === "attended" && (
              <>
                <button
                  disabled={isSaving}
                  onClick={() =>
                    void onUpdate(referral, "result_reported", "fit")
                  }
                  className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Apto
                </button>
                <button
                  disabled={isSaving}
                  onClick={() =>
                    void onUpdate(referral, "result_reported", "unfit")
                  }
                  className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  Inapto
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-slate-100">
          <td />
          <td colSpan={5} className="p-0">
            <div className="p-4">
              <ReferralAttachments referralId={referral.id} />
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

export function OccupationalHealthPortal() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc("list_my_medical_referrals");
    if (rpcError) setError("Não foi possível carregar os encaminhamentos autorizados.");
    else setReferrals((data || []) as Referral[]);
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);

  const totals = useMemo(() => ({
    pending: referrals.filter((item) => item.status === "referred").length,
    scheduled: referrals.filter((item) => item.status === "scheduled").length,
    done: referrals.filter((item) => ["result_reported", "completed"].includes(item.status)).length,
  }), [referrals]);

  const update = async (referral: Referral, status: ReferralStatus, result: FitnessResult = "pending") => {
    setSavingId(referral.id);
    setError(null);
    const { error: rpcError } = await supabase.rpc("update_medical_referral", {
      p_referral_id: referral.id,
      p_status: status,
      p_scheduled_for: status === "scheduled" ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() : null,
      p_scheduled_location: status === "scheduled" ? "A confirmar pela clínica" : null,
      p_fitness_result: result,
      p_clinic_note: null,
    });
    if (rpcError) setError("A atualização não foi aceita. Verifique os dados e sua permissão na clínica.");
    else await load();
    setSavingId(null);
  };

  return (
    <main className="min-h-screen bg-slate-50 p-4 sm:p-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-primary">Saúde ocupacional</p>
            <h1 className="text-3xl font-bold text-slate-900">Encaminhamentos médicos</h1>
            <p className="mt-2 text-sm text-slate-600">Acesse somente os candidatos formalmente encaminhados à sua clínica.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/saude-ocupacional/conversas" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Conversas com empresas</Link>
            <button onClick={() => void load()} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700">Atualizar</button>
          </div>
        </header>

        <section className="mb-8 grid gap-4 sm:grid-cols-3">
          {[
            ["Novos", totals.pending, ClipboardList],
            ["Agendados", totals.scheduled, CalendarClock],
            ["Finalizados", totals.done, CheckCircle2],
          ].map(([label, value, Icon]) => {
            const CardIcon = Icon as typeof ClipboardList;
            return <div key={String(label)} className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"><CardIcon className="mb-3 h-5 w-5 text-primary" /><p className="text-2xl font-bold text-slate-900">{String(value)}</p><p className="text-sm text-slate-600">{String(label)}</p></div>;
          })}
        </section>

        {error && <div className="mb-5 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}
        {loading ? <div className="flex justify-center p-12"><LoaderCircle className="h-8 w-8 animate-spin text-primary" /></div> : referrals.length === 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600">Nenhum encaminhamento ativo foi liberado para esta clínica.</div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="p-4" />
                  <th className="p-4">Candidato</th>
                  <th className="p-4">Exame / vaga</th>
                  <th className="p-4">Agendamento</th>
                  <th className="p-4">Status</th>
                  <th className="p-4">Ações</th>
                </tr>
              </thead>
              <tbody>
                {referrals.map((referral) => (
                  <ReferralRow
                    key={referral.id}
                    referral={referral}
                    savingId={savingId}
                    expanded={expandedId === referral.id}
                    onToggleExpand={() =>
                      setExpandedId(
                        expandedId === referral.id ? null : referral.id,
                      )
                    }
                    onUpdate={update}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
