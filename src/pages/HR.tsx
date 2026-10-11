import React, { useState, useRef, useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  Briefcase,
  Users,
  CheckSquare,
  MessageSquare,
  FileCheck,
  Plus,
  Search,
  MoreVertical,
  Clock,
  TrendingUp,
  TrendingDown,
  Target,
  Heart,
  Award,
  PieChart as PieChartIcon,
  BarChart3,
  Download,
  Filter,
  XCircle,
  PauseCircle,
  PlayCircle,
  CheckCircle,
  ArrowLeft,
  Save,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  X,
  UserPlus,
  CheckCircle2,
  User,
  Info,
  GraduationCap,
  MapPin,
  History,
  MessageCircle,
  Send,
  AlertCircle,
  Eye,
  File,
  Image as ImageIcon,
  FileText,
  Repeat,
  Layers,
  Trash2,
  PlusCircle,
  ExternalLink,
  Sparkles,
} from "lucide-react";
import { uploadFiles } from "../lib/upload";
import { safeFetch } from "../lib/api";
import { TransferOwnerModal } from "../components/TransferOwnerModal";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  LabelList,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { supabase } from "../lib/supabase";
import { logAudit } from "../lib/audit";
import { logCandidaturaEvento } from "../lib/events";
import { ChatInput } from "../components/ChatInput";
import { useAuth } from "../contexts/AuthContext";
import { useVagas } from "../lib/useVagas";

const tempoPorEtapaData = [
  { name: "Triagem", dias: 0 },
  { name: "Entrevista RH", dias: 0 },
  { name: "Prova", dias: 0 },
  { name: "Entrevista Gestor", dias: 0 },
  { name: "Proposta", dias: 0 },
];

const funilData = [
  { name: "Triagem", value: 0 },
  { name: "Prova", value: 0 },
  { name: "Entrevista RH", value: 0 },
  { name: "Entrevista Gestor", value: 0 },
  { name: "Contrato", value: 0 },
];

const motivosDeclinioData = [
  { name: "Salário", value: 0 },
  { name: "Benefícios", value: 0 },
  { name: "Modelo de Trabalho", value: 0 },
  { name: "Outros", value: 0 },
];

const volumeContratacoesData = [
  { name: "Jan", contratacoes: 0 },
  { name: "Fev", contratacoes: 0 },
  { name: "Mar", contratacoes: 0 },
  { name: "Abr", contratacoes: 0 },
  { name: "Mai", contratacoes: 0 },
  { name: "Jun", contratacoes: 0 },
];

const fonteOrigemData = [
  { name: "LinkedIn", value: 0 },
  { name: "Indicação", value: 0 },
  { name: "Site DFL", value: 0 },
  { name: "Gupy/Outros", value: 0 },
];

const COLORS = ["#818cf8", "#34d399", "#fbbf24", "#fb7185", "#a78bfa"];
const PRIMARY_COLORS = ["#38bdf8", "#4ade80", "#facc15", "#f472b6", "#c084fc"];

const ETAPAS_PROCESSO = [
  "Triagem",
  "Entrevista RH",
  "Prova",
  "Entrevista Gestor",
  "Proposta",
  "Entrega de documentação",
  "Exame Médico",
  "Contrato",
];

const getProximaFase = (faseAtual: string, vaga?: any) => {
  const exigeProva = vaga?.exige_prova === true || vaga?.exige_prova === "Sim";

  // The legacy "Exame" action is explicitly labeled as the hiring decision.
  // The database still requires a linked, non-cancelled fit admission exam.
  if (faseAtual === "Exame") return "Contratado";

  if (faseAtual === "Prova" && !exigeProva) {
    return "Entrevista Gestor";
  }

  const etapasFiltradas = ETAPAS_PROCESSO.filter((etapa) => {
    if (etapa === "Prova") {
      return exigeProva;
    }
    return true;
  });

  const index = etapasFiltradas.indexOf(faseAtual);
  if (index === -1) return faseAtual;

  let proxima = etapasFiltradas[index + 1];

  // A última etapa configurada é "Contrato"; concluir sua aprovação registra a contratação real.
  return proxima || "Contratado";
};

const getStages = (vaga: any) => {
  return ETAPAS_PROCESSO.filter((etapa) => {
    if (etapa === "Prova") {
      return vaga?.exige_prova === true || vaga?.exige_prova === "Sim";
    }
    return true;
  }).map((etapa) => ({ id: etapa, label: etapa }));
};

const getResumeData = (data: any) => {
  if (!data) return {};

  const nestedResume =
    data.resume_data ||
    data.resumeData ||
    data.curriculo ||
    data.curriculum ||
    data.dados ||
    {};

  return {
    ...data,
    ...nestedResume,
    nome:
      nestedResume.nome ||
      data.nome ||
      data.full_name ||
      data.nome_completo ||
      "",
    email: nestedResume.email || data.email || "",
    telefone:
      nestedResume.telefone ||
      nestedResume.celular ||
      data.telefone ||
      data.celular ||
      "",
    dataNascimento:
      nestedResume.dataNascimento ||
      nestedResume.data_nascimento ||
      data.dataNascimento ||
      data.data_nascimento ||
      data.nascimento ||
      "",
    genero: nestedResume.genero || data.genero || "",
    pcd: nestedResume.pcd ?? data.pcd ?? "",
    endereco: nestedResume.endereco || data.endereco || "",
    bairro: nestedResume.bairro || data.bairro || "",
    cidade: nestedResume.cidade || data.cidade || "",
    estado: nestedResume.estado || data.estado || "",
    cep: nestedResume.cep || data.cep || "",
    comoSoube:
      nestedResume.comoSoube ||
      nestedResume.como_soube ||
      data.comoSoube ||
      data.como_soube ||
      data.origem ||
      "",
    resumo:
      nestedResume.resumo ||
      nestedResume.resumo_profissional ||
      data.resumo ||
      data.resumo_profissional ||
      "",
    habilidades: nestedResume.habilidades || data.habilidades || [],
    idiomas: nestedResume.idiomas || data.idiomas || [],
    experiencias:
      nestedResume.experiencias ||
      nestedResume.experiencia_profissional ||
      data.experiencias ||
      data.experiencia_profissional ||
      [],
    formacoes:
      nestedResume.formacoes ||
      nestedResume.formacao_academica ||
      data.formacoes ||
      data.formacao_academica ||
      [],
    formacao: nestedResume.formacao || data.formacao || "",
    certificacoes: nestedResume.certificacoes || data.certificacoes || [],
    foto:
      nestedResume.foto ||
      nestedResume.foto_url ||
      data.foto ||
      data.foto_url ||
      data.avatar_url ||
      "",
  };
};

const calcularIdade = (dataNascimento?: string) => {
  if (!dataNascimento) return "Não informada";

  const nascimento = new Date(dataNascimento);
  if (isNaN(nascimento.getTime())) return "Não informada";

  const hoje = new Date();
  let idade = hoje.getFullYear() - nascimento.getFullYear();

  const m = hoje.getMonth() - nascimento.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < nascimento.getDate())) {
    idade--;
  }

  return `${idade} anos`;
};

const getLocalizacao = (resumeData: any) => {
  const bairro = resumeData?.bairro;
  const cidade = resumeData?.cidade;

  if (bairro && cidade) return `${bairro} - ${cidade}`;
  if (cidade) return cidade;

  return "Não informada";
};

function CandidateProfileModal({
  candidato,
  candidaturaId,
  vaga,
  onActionComplete,
  onClose,
  showDecisionActions = true,
}: {
  candidato: any;
  candidaturaId?: string;
  vaga?: any;
  onActionComplete?: () => void;
  onClose: () => void;
  showDecisionActions?: boolean;
}) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [candidatura, setCandidatura] = useState<any>(null);
  const [fullCandidatoData, setFullCandidatoData] = useState<any>(null);
  const [notaTeste, setNotaTeste] = useState("");
  const [aprovacaoTeste, setAprovacaoTeste] = useState("");
  const [observacoesTeste, setObservacoesTeste] = useState("");
  const [dataTeste, setDataTeste] = useState("");
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newChatMessage, setNewChatMessage] = useState("");
  const { profile } = useAuth();
  const chatEndRef = useRef<HTMLDivElement>(null);
  const modalContentRef = useRef<HTMLDivElement>(null);
  const [aiEvaluation, setAiEvaluation] = useState<any>(null);
  const [isReferring, setIsReferring] = useState(false);
  const [referralSuccess, setReferralSuccess] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");

  // Scroll para o topo quando o modal abre
  useEffect(() => {
    if (modalContentRef.current) {
      modalContentRef.current.scrollTop = 0;
    }
  }, [candidato?.id, candidaturaId]);

  // Scroll para o final do chat apenas quando há novas mensagens
  useEffect(() => {
    if (chatEndRef.current && chatMessages.length > 0) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chatMessages]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        let candidatoIdToFetch = null;

        // SEMPRE tenta buscar pelo ID do candidato prop PRIMEIRO
        if (candidato?.id) {
          const { data: cData } = await supabase
            .from("users")
            .select("id, uid")
            .or(`id.eq.${candidato.id},uid.eq.${candidato.id}`)
            .maybeSingle();

          if (cData) {
            candidatoIdToFetch = cData.id || cData.uid;
          }
        }

        // Se ainda não encontrou, busca da candidatura
        if (!candidatoIdToFetch && candidaturaId) {
          const { data, error } = await supabase
            .from("candidaturas")
            .select("*")
            .eq("id", candidaturaId)
            .maybeSingle();

          if (!error && data) {
            setCandidatura(data);
            setNotaTeste(data.nota_teste || "");
            setAprovacaoTeste(data.aprovacao_teste || "");
            setObservacoesTeste(data.observacoes_teste || "");
            setDataTeste(data.data_teste || "");

            // Só usa o candidato_id da candidatura se não encontrou pelo user_id
            if (!candidatoIdToFetch) {
              candidatoIdToFetch = data.candidato_id;
            }
          }
        }

        if (candidatoIdToFetch) {
          // Busca principal na tabela users
          const { data: fullData, error: fullError } = await supabase
            .from("users")
            .select("*")
            .or(`id.eq.${candidatoIdToFetch},uid.eq.${candidatoIdToFetch}`)
            .maybeSingle();

          let resolvedCandidatoData = fullData;
          const resumeFromUsers =
            fullData?.resume_data || fullData?.resumeData || {};
          const resumeFromProp =
            candidato?.resume_data || candidato?.resumeData || {};
          const needsCandidaturaFallback =
            !resolvedCandidatoData ||
            Object.keys(resumeFromUsers).length === 0 ||
            (Object.keys(resumeFromUsers).length <= 3 &&
              Object.keys(resumeFromProp).length >
                Object.keys(resumeFromUsers).length);

          if (needsCandidaturaFallback && candidatura?.candidato_id) {
            const { data: candidatoFallback, error: candidatoFallbackError } =
              await supabase
                .from("candidatos")
                .select("*")
                .eq("id", candidatura.candidato_id)
                .maybeSingle();

            if (!candidatoFallbackError && candidatoFallback) {
              const fallbackResume =
                candidatoFallback.resume_data ||
                candidatoFallback.resumeData ||
                candidatoFallback.curriculo ||
                candidatoFallback.curriculum ||
                candidatoFallback.dados ||
                {};

              resolvedCandidatoData = {
                ...(fullData || {}),
                ...candidatoFallback,
                nome:
                  fullData?.nome ||
                  candidatoFallback.nome ||
                  candidato?.nome ||
                  "Sem Nome",
                email:
                  fullData?.email ||
                  candidatoFallback.email ||
                  candidato?.email ||
                  "Não informado",
                resume_data:
                  Object.keys(fallbackResume).length > 0
                    ? fallbackResume
                    : candidatoFallback.resume_data ||
                      candidatoFallback.resumeData ||
                      fullData?.resume_data ||
                      fullData?.resumeData ||
                      candidato?.resume_data ||
                      candidato?.resumeData ||
                      {},
              };
            }
          }

          if (!fullError && resolvedCandidatoData) {
            setFullCandidatoData(resolvedCandidatoData);

            // A análise é criada no momento da candidatura. O RH apenas
            // lê o resultado persistido e nunca dispara uma nova geração.
            if (candidaturaId) {
              const { data: existingAnalysis, error: analysisError } =
                await supabase
                  .from("analise_ia_candidato")
                  .select("id,status,result,input_hash,created_at,updated_at")
                  .eq("candidatura_id", candidaturaId)
                  .order("created_at", { ascending: false })
                  .limit(1)
                  .maybeSingle();

              if (analysisError) {
                console.warn("Erro ao buscar análise IA existente:", analysisError);
              }

              const cachedResult = existingAnalysis?.result;
              if (
                existingAnalysis?.status === "completed" &&
                cachedResult &&
                typeof cachedResult === "object"
              ) {
                const result = cachedResult as any;
                setAiEvaluation({
                  ...result,
                  metricas: {
                    tecnico: result.score_tecnico,
                    experiencia: result.score_experiencia,
                    formacao: result.score_formacao,
                    soft_skills: result.score_soft_skills,
                    cultura: result.score_cultura,
                  },
                  justificativa: result.resumo_ia,
                });
              }
            }
          }
        }
      } catch (error) {
        console.error("Erro ao buscar dados do candidato:", error);
      }
    };
    fetchData();
  }, [candidaturaId, candidato?.id]);

  useEffect(() => {
    if (!candidaturaId) return;

    const fetchMessages = async () => {
      try {
        const { data, error } = await supabase
          .from("mensagens")
          .select("*")
          .eq("candidatura_id", candidaturaId)
          .order("criado_em", { ascending: true });

        if (error) throw error;
        setChatMessages(data || []);
      } catch (error) {
        console.error("Erro ao buscar mensagens:", error);
      }
    };

    fetchMessages();

    const channel = supabase
      .channel(`mensagens_${candidaturaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `candidatura_id=eq.${candidaturaId}`,
        },
        (payload) => {
          setChatMessages((prev) => {
            if (prev.find((m) => m.id === payload.new.id)) return prev;
            return [...prev, payload.new];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [candidaturaId]);

  const handleSendMessage = async (text: string, attachments: any[]) => {
    if (!candidaturaId || !profile?.nome) return;

    try {
      const remetenteId = profile.id || profile.uid;

      const { error } = await supabase.from("mensagens").insert({
        id: crypto.randomUUID(),
        candidatura_id: candidaturaId,
        remetente_id: remetenteId,
        texto: text,
        anexos: attachments,
        criado_em: new Date().toISOString(),
        created_at: new Date().toISOString(),
        tamanho_total: Array.isArray(attachments)
          ? attachments.reduce(
              (total: number, item: any) =>
                total + Number(item?.size || item?.tamanho || 0),
              0,
            )
          : 0,
      });

      if (error) throw error;

      await logCandidaturaEvento(
        candidaturaId,
        "MENSAGEM",
        `Mensagem enviada pelo RH: ${text.substring(0, 50)}${text.length > 50 ? "..." : ""}`,
        remetenteId,
      );

      try {
        const { data: configData } = await supabase
          .from("settings")
          .select("*")
          .eq("id", "email")
          .maybeSingle();

        const settings = configData?.data || configData || {};
        const rhEmail = profile?.email || settings.smtpUser || "";

        const subject = (
          settings.emailTemplateSubject ||
          "Nova Mensagem do RH - [Título da Vaga]"
        )
          .replace("[Nome do Candidato]", nome)
          .replace("[Título da Vaga]", vaga?.titulo || "Vaga")
          .replace("[Nome do RH]", profile?.nome || "RH")
          .replace("[Email do RH]", rhEmail);

        const body = (
          settings.emailTemplateBody ||
          "Olá [Nome do Candidato],\n\nVocê tem uma nova mensagem do RH referente à vaga [Título da Vaga].\n\nMensagem:\n[Mensagem do Convite]\n\nAtenciosamente,\n[Nome do RH]\n[Email do RH]"
        )
          .replace("[Nome do Candidato]", nome)
          .replace("[Título da Vaga]", vaga?.titulo || "Vaga")
          .replace("[Nome do RH]", profile?.nome || "RH")
          .replace("[Email do RH]", rhEmail)
          .replace("[Mensagem do Convite]", text);

        if (email && email !== "Não informado") {
          try {
            await safeFetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: email,
                subject,
                body,
                smtpConfig: {
                  smtpHost: settings.smtpHost,
                  smtpPort: settings.smtpPort,
                  smtpUser: settings.smtpUser,
                  smtpPass: settings.smtpPass,
                },
              }),
            });
          } catch (emailError) {
            console.warn(
              "Falha não bloqueante ao enviar e-mail de mensagem:",
              emailError,
            );
          }
        }
      } catch (emailError) {
        console.warn(
          "Falha não bloqueante ao enfileirar e-mail da mensagem:",
          emailError,
        );
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Erro ao enviar mensagem.");
    }
  };

  if (!candidato && !fullCandidatoData) return null;

  const resume = getResumeData({
    ...(candidato?.candidato || {}),
    ...(candidato || {}),
    ...(candidatura || {}),
    ...(fullCandidatoData || {}),
  });
  const nome =
    fullCandidatoData?.nome ||
    fullCandidatoData?.full_name ||
    resume.nome ||
    candidato?.nome ||
    "Não informado";
  const email =
    fullCandidatoData?.email ||
    resume.email ||
    candidato?.email ||
    "Não informado";
  const experiencia =
    resume.resumo || fullCandidatoData?.resumo || "Não informado";

  const currentFase = candidatura?.fase || "Triagem";
  const currentStatus = candidatura?.status;
  const isVisualizado = candidatura?.visualizado || false;

  const handleAction = async (action: "Aprovar" | "Reprovar" | "Reserva") => {
    if (selectedCandidates.length === 0) return;

    const vaga = vagas.find((v) => v.id === selectedVaga);
    const attemptedIds = [...selectedCandidates];
    const historyFailures: string[] = [];

    try {
      // Processa cada candidatura isoladamente. Uma falha não cancela a espera
      // pelos demais itens nem faz o frontend ocultar atualizações já confirmadas.
      const outcomes = await Promise.all(
        attemptedIds.map(async (id) => {
          try {
            const { data: currentData, error: fetchError } = await supabase
              .from("candidaturas")
              .select("*")
              .eq("id", id)
              .maybeSingle();

            if (fetchError) {
              console.error("Falha ao consultar candidatura da ação em massa:", id, fetchError);
              return { id, ok: false as const, reason: "consulta" };
            }
            if (!currentData) {
              return { id, ok: false as const, reason: "indisponível" };
            }

            const currentFase = currentData.fase || currentData.status || "Triagem";
            const stages = getStages(vaga);
            let newFase = currentFase;
            let newStatus = currentData.status || "ATIVO";

            if (action === "Aprovar") {
              const currentIndex = stages.findIndex((s) => s.id === currentFase);
              if (currentFase === "Exame") {
                newFase = "Contratado";
                newStatus = "Contratado";
              } else if (currentIndex >= 0 && currentIndex < stages.length - 1) {
                newFase = stages[currentIndex + 1].id;
                newStatus = "APROVADA";
              } else if (currentIndex === stages.length - 1) {
                newFase = "Contratado";
                newStatus = "Contratado";
              } else {
                newStatus = "APROVADA";
              }
            } else if (action === "Reprovar") {
              if (currentFase === "Exame") {
                newFase = "Entrevista RH";
                newStatus = "APROVADA";
              } else {
                newFase = "Encerrado";
                newStatus = "REPROVADA";
              }
            } else {
              newFase = "Banco de Talentos";
              newStatus = "RESERVA";
            }

            if (newFase === "Contratado") newStatus = "Contratado";
            if (newStatus === "REPROVADA") newFase = "Encerrado";

            const { error: updateError } = await supabase.rpc(
              "rpc_atualizar_candidatura_processo",
              {
                p_id: id,
                p_fase: newFase,
                p_status: newStatus,
                p_visualizado: true,
                p_updated_at: new Date().toISOString(),
              },
            );

            if (updateError) {
              console.error("Falha ao atualizar candidatura na ação em massa:", id, updateError);
              return { id, ok: false as const, reason: "atualização" };
            }

            try {
              await logCandidaturaEvento(
                id,
                action.toUpperCase() as any,
                `Candidato ${action === "Aprovar" ? "avançou para " + newFase : action === "Reprovar" ? "reprovado" : "movido para reserva"}`,
                profile?.id,
              );
            } catch (historyError) {
              // O estágio já foi gravado pela RPC. Reportamos a falha de histórico
              // separadamente, sem contabilizar a transição como se tivesse falhado.
              historyFailures.push(id);
              console.error("Transição concluída, mas falhou o histórico:", id, historyError);
            }

            return { id, ok: true as const, newStatus };
          } catch (itemError) {
            console.error("Falha inesperada em item da ação em massa:", id, itemError);
            return { id, ok: false as const, reason: "erro inesperado" };
          }
        }),
      );

      const succeeded = outcomes.filter((item) => item.ok);
      const failed = outcomes.filter((item) => !item.ok);
      const succeededIds = new Set(succeeded.map((item) => item.id));

      setCandidatos((current) => current.filter((candidate) => !succeededIds.has(candidate.id)));
      if (succeeded.length > 0) {
        setVagas((current) =>
          current.map((v) =>
            v.id === selectedVaga
              ? { ...v, candidaturas: Math.max(0, v.candidaturas - succeeded.length) }
              : v,
          ),
        );
      }

      try {
        await logAudit(
          "Ação em Massa",
          "Candidatos",
          `Ação ${action}: ${succeeded.length} concluídas, ${failed.length} falharam, ${historyFailures.length} sem histórico.`,
        );
      } catch (logError) {
        console.warn("Transições processadas, mas falhou a auditoria da ação em massa:", logError);
      }

      // Mantém selecionadas somente as candidaturas que precisam de nova tentativa.
      setSelectedCandidates(failed.map((item) => item.id));

      if (failed.length === 0 && historyFailures.length === 0) {
        alert(`Ação aplicada a ${succeeded.length} candidatos.`);
      } else {
        alert(
          `Resultado parcial: ${succeeded.length} candidaturas atualizadas; ${failed.length} falharam.` +
          (historyFailures.length > 0 ? ` O histórico falhou em ${historyFailures.length} candidatura(s); verifique os logs.` : "") +
          (failed.length > 0 ? " As candidaturas que falharam permaneceram selecionadas para nova tentativa." : ""),
        );
      }
    } catch (error) {
      console.error("Erro ao preparar ação em massa:", error);
      alert("Não foi possível concluir a ação em massa. Verifique a conexão e tente novamente.");
    }
  };

  const handleSingleAction = async (
    id: string,
    action: "Aprovar" | "Reprovar" | "Reserva",
  ) => {
    try {
      const { data: currentData, error: fetchError } = await supabase
        .from("candidaturas")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError || !currentData) return;

      const currentFase = currentData.fase ?? "Triagem";
      const currentStatus = currentData.status ?? "ATIVO";
      const vaga = vagas.find((v) => v.id === selectedVaga);

      let newFase = currentFase;
      let newStatus = currentStatus;

      if (action === "Aprovar") {
        newFase = getProximaFase(currentFase, vaga);
        newStatus = newFase === "Contratado" ? "Contratado" : "ATIVO";
      } else if (action === "Reprovar") {
        if (currentFase === "Exame") {
          newStatus = "APROVADA";
          newFase = "Entrevista RH";
        } else {
          newStatus = "REPROVADA";
          newFase = "Encerrado";
        }
      } else if (action === "Reserva") {
        newStatus = "RESERVA";
      }

      console.log(
        "Ação:",
        action,
        "Fase Atual:",
        currentFase,
        "Nova Fase:",
        newFase,
        "Novo Status:",
        newStatus,
      );

      if (
        newFase === currentFase &&
        newStatus === currentData.status &&
        action === "Aprovar"
      ) {
        // Preservar o status canônico se a fase atual já for a de contratação.
        newStatus = newFase === "Contratado" ? "Contratado" : "APROVADA";
      }

      if (newFase === currentFase && newStatus === currentData.status) {
        console.log("Nenhuma mudança detectada, abortando update.");
        return;
      }

      const payload = {
        status: newStatus,
        fase: newFase,
        visualizado: true,
        updated_at: new Date().toISOString(),
      };

      console.log("Payload enviado (handleSingleAction):", payload);

      const { data, error: updateError } = await supabase.rpc(
        "rpc_atualizar_candidatura_processo",
        {
          p_id: id,
          p_fase: payload.fase,
          p_status: payload.status,
          p_visualizado: payload.visualizado,
          p_updated_at: payload.updated_at,
        },
      );

      console.log("Resposta (handleSingleAction RPC):", data, updateError);

      if (updateError) throw updateError;

      // Registrar evento de histórico
      await logCandidaturaEvento(
        id,
        action.toUpperCase() as any,
        `Candidato ${action === "Aprovar" ? "avançou para " + newFase : action === "Reprovar" ? "reprovado" : "movido para reserva"}`,
        profile?.id,
      );

      setCandidatos(candidatos.filter((c) => c.id !== id));
      setVagas(
        vagas.map((v) =>
          v.id === selectedVaga
            ? { ...v, candidaturas: Math.max(0, v.candidaturas - 1) }
            : v,
        ),
      );
      try {
        await logAudit(
          "Ação Individual",
          "Candidatos",
          `Ação ${action} aplicada a 1 candidato.`,
        );
      } catch (logError) {
        console.warn("Erro ao registrar log:", logError);
      }
    } catch (error) {
      console.error("Erro ao aplicar ação:", error);
      alert("Erro ao aplicar ação. Tente novamente.");
    }
  };

  if (selectedVaga) {
    const vaga = vagas.find((v) => v.id === selectedVaga);
    const isOwnerOrAdmin =
      profile?.perfil === "Admin" || vaga?.ownerId === profile?.uid;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex flex-col">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                  setSelectedVaga(null);
                  setSelectedCandidates([]);
                }}
                className="text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-2xl font-bold text-slate-900">
                Candidatos: {vaga?.cargo}
                <span className="ml-3 text-sm font-medium bg-primary/10 text-primary px-3 py-1 rounded-full">
                  Total: {filteredCandidatos.length}
                </span>
              </h2>
            </div>
            <div className="mt-2 text-[10px] text-slate-400 font-mono bg-slate-50 px-2 py-1 rounded border border-slate-100 italic">
              Debug: Dados brutos encontrados para esta vaga:{" "}
              {candidatos.filter((c) => c.vagaId === selectedVaga).length}{" "}
              registros (Filtro Atual: {filteredCandidatos.length})
            </div>
          </div>
          {selectedCandidates.length > 0 && (
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm border border-slate-200">
              <span className="text-sm font-medium text-slate-600 mr-2">
                {selectedCandidates.length} selecionados
              </span>
              {isOwnerOrAdmin ? (
                <>
                  <button
                    onClick={() => handleAction("Aprovar")}
                    className="text-xs font-medium bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded hover:bg-emerald-100 transition-colors"
                  >
                    Aprovar
                  </button>
                  <button
                    onClick={() => handleAction("Reprovar")}
                    className="text-xs font-medium bg-red-50 text-red-600 px-3 py-1.5 rounded hover:bg-red-100 transition-colors"
                  >
                    Reprovar
                  </button>
                  <button
                    onClick={() => handleAction("Reserva")}
                    className="text-xs font-medium bg-amber-50 text-amber-600 px-3 py-1.5 rounded hover:bg-amber-100 transition-colors"
                  >
                    Reserva
                  </button>
                </>
              ) : (
                <span className="text-xs text-slate-400 italic">
                  Somente proprietário pode executar ações
                </span>
              )}
              <button
                onClick={() => setSelectedCandidates([])}
                className="text-xs font-medium text-slate-500 hover:text-slate-700 ml-2"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3 w-12 text-center">
                    <input
                      type="checkbox"
                      onChange={handleSelectAll}
                      checked={
                        filteredCandidatos.length > 0 &&
                        selectedCandidates.length === filteredCandidatos.length
                      }
                      className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                    />
                  </th>
                  <th className="px-4 py-3">Nome</th>
                  <th className="px-4 py-3">Data Candidatura</th>
                  <th className="px-4 py-3">Formação</th>
                  <th className="px-4 py-3">Idade</th>
                  <th className="px-4 py-3">Localização</th>
                  <th
                    className="px-4 py-3 cursor-pointer group"
                    onClick={() => handleCandidatosSort("score_total")}
                  >
                    <div className="flex items-center gap-1">
                      Score IA
                      {renderCandidatosSortIcon("score_total")}
                    </div>
                  </th>
                  <th className="px-4 py-3">Fase</th>
                  <th className="px-4 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCandidatos.length > 0 ? (
                  filteredCandidatos
                    .sort((a, b) => {
                      if (!candidatosSortConfig) {
                        if (!a.visualizado && b.visualizado) return -1;
                        if (a.visualizado && !b.visualizado) return 1;
                        return 0;
                      }
                      const key = candidatosSortConfig.key;
                      const dir =
                        candidatosSortConfig.direction === "asc" ? 1 : -1;

                      let aVal = a[key];
                      let bVal = b[key];

                      if (aVal === null || aVal === undefined) aVal = "";
                      if (bVal === null || bVal === undefined) bVal = "";

                      if (aVal < bVal) return -1 * dir;
                      if (aVal > bVal) return 1 * dir;
                      return 0;
                    })
                    .map((c) => {
                      const nextStage =
                        c.fase === "Prova"
                          ? "Entrevista Gestor"
                          : "Entrevista RH";
                      return (
                        <tr
                          key={c.id}
                          onClick={async () => {
                            setSelectedCandidato(c.candidato);
                            setSelectedCandidaturaId(c.id);

                            // Marcar como visualizado se for NOVO
                            if (!c.visualizado) {
                              try {
                                const { error: markViewedError } = await supabase.rpc(
                                  "rpc_marcar_candidatura_visualizada",
                                  { p_id: c.id },
                                );
                                if (markViewedError) throw markViewedError;

                                // Atualizar estado local
                                setCandidatos((prev) =>
                                  prev.map((cand) =>
                                    cand.id === c.id
                                      ? {
                                          ...cand,
                                          visualizado: true,
                                          rhVisualizouRecrutamento: true,
                                        }
                                      : cand,
                                  ),
                                );
                              } catch (error) {
                                console.error(
                                  "Erro ao marcar como visualizado:",
                                  error,
                                );
                              }
                            }
                          }}
                          className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedCandidates.includes(c.id) ? "bg-primary/5" : ""} ${!c.visualizado ? "bg-orange-50/50" : ""}`}
                        >
                          <td
                            className="px-4 py-3 text-center"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCandidates.includes(c.id)}
                              onChange={() => handleSelectCandidate(c.id)}
                              className="rounded border-slate-300 text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                            />
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="font-medium text-slate-900">
                                {c.nome}
                              </div>
                              {!c.visualizado && (
                                <span className="bg-orange-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                                  Novo
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-slate-500">
                              {c.candidato?.email || "Sem email"}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {formatDateTime(c.dataCandidatura)}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {c.formacao}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {c.idade}
                          </td>
                          <td className="px-4 py-3 text-slate-500">
                            {c.localizacao}
                          </td>
                          <td className="px-4 py-3">
                            {c.score_total !== null &&
                            c.score_total !== undefined ? (
                              <div
                                className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold ${
                                  c.score_total >= 80
                                    ? "bg-green-100 text-green-700 border border-green-200"
                                    : c.score_total >= 60
                                      ? "bg-blue-100 text-blue-700 border border-blue-200"
                                      : c.score_total >= 40
                                        ? "bg-amber-100 text-amber-700 border border-amber-200"
                                        : "bg-red-100 text-red-700 border border-red-200"
                                }`}
                              >
                                <Sparkles className="w-3 h-3" />
                                {c.score_total}/100
                              </div>
                            ) : (
                              <div className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-100 text-slate-400 border border-slate-200">
                                <AlertCircle className="w-3 h-3" />
                                Não avaliado
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                                c.fase === "Prova"
                                  ? "bg-purple-100 text-purple-700"
                                  : c.fase === "Reserva"
                                    ? "bg-amber-100 text-amber-700"
                                    : "bg-slate-100 text-slate-700"
                              }`}
                            >
                              {c.fase || "Triagem"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-3">
                              {isOwnerOrAdmin ? (
                                <>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setSelectedCandidato(c.candidato);
                                      setSelectedCandidaturaId(c.id);
                                    }}
                                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                                  >
                                    <Eye className="w-3 h-3" /> Ver Currículo
                                  </button>
                                </>
                              ) : (
                                <span className="text-[10px] text-slate-400 italic">
                                  Somente proprietário
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-slate-500 italic"
                    >
                      Nenhum candidato encontrado nesta triagem.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {selectedCandidato && (
          <CandidateProfileModal
            candidato={selectedCandidato}
            candidaturaId={selectedCandidaturaId || undefined}
            vaga={vagas.find((v) => v.id === selectedVaga)}
            onActionComplete={fetchData}
            onClose={() => {
              setSelectedCandidato(null);
              setSelectedCandidaturaId(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Triagem</h2>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 w-full max-w-md">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Buscar vagas..."
            className="w-full px-2 py-1 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-1/6">
                  {renderFilterInput("codigo_vaga", "Código")}
                </th>
                <th className="px-6 py-4 w-1/3">
                  {renderFilterInput("cargo", "Vaga")}
                </th>
                <th className="px-6 py-4 w-1/4">
                  {renderFilterInput("criadaEm", "Criada em")}
                </th>
                <th className="px-6 py-4 w-1/4">
                  {renderFilterInput("status", "Status")}
                </th>
                <th className="px-6 py-4 text-center w-1/6">
                  {renderFilterInput("candidaturas", "Candidatos")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVagas.map((vaga) => (
                <tr
                  key={vaga.id}
                  onClick={() => setSelectedVaga(vaga.id)}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${vaga.novidades > 0 ? "bg-orange-50/50" : ""}`}
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {vaga.codigo_vaga || "-"}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {vaga.cargo}
                      {vaga.novidades > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full">
                          {vaga.novidades > 99 ? "99+" : vaga.novidades}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">{formatDateTime(vaga.criadaEm)}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        vaga.status === "Aberta"
                          ? "bg-emerald-100 text-emerald-700"
                          : vaga.status === "Pausada"
                            ? "bg-amber-100 text-amber-700"
                            : vaga.status === "Encerrada"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      {vaga.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-primary">
                    {vaga.candidaturas}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

const HistoryModal = ({
  isOpen,
  onClose,
  nomeCandidato,
  candidaturaId,
}: {
  isOpen: boolean;
  onClose: () => void;
  nomeCandidato: string;
  candidaturaId?: string;
}) => {
  const [eventos, setEventos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && candidaturaId) {
      const fetchEventos = async () => {
        setLoading(true);
        try {
          const { data, error } = await supabase
            .from("candidatura_eventos")
            .select("*, users(nome)")
            .eq("candidatura_id", candidaturaId)
            .order("created_at", { ascending: false });

          if (error) throw error;
          setEventos(data || []);
        } catch (error) {
          console.error("Erro ao buscar eventos:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchEventos();
    }
  }, [isOpen, candidaturaId]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <History className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Histórico de Recrutamento: {nomeCandidato}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12 text-slate-500">
              Carregando histórico...
            </div>
          ) : eventos.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              Nenhum histórico registrado para este candidato.
            </div>
          ) : (
            <div className="relative border-l-2 border-slate-200 ml-4 space-y-8 pb-4">
              {eventos.map((item, index) => (
                <div key={item.id || index} className="relative pl-8">
                  <div
                    className={`absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 ${
                      item.tipo === "APROVADA"
                        ? "border-emerald-500"
                        : item.tipo === "REPROVADA"
                          ? "border-red-500"
                          : item.tipo === "RESERVA"
                            ? "border-amber-500"
                            : "border-primary"
                    }`}
                  />
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 uppercase text-xs tracking-wider">
                        {item.tipo}
                      </span>
                      <span className="text-[10px] text-slate-400">
                        {new Date(item.created_at).toLocaleString("pt-BR")}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 mt-1">
                      {item.descricao}
                    </p>
                    <div className="text-[10px] text-slate-400 mt-1">
                      Por: {item.users?.nome || "Sistema"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end items-center">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

const SendMessageModal = ({
  isOpen,
  onClose,
  candidaturaId,
  candidatoNome,
  vagaId,
  candidatoId,
}: {
  isOpen: boolean;
  onClose: () => void;
  candidaturaId: string;
  candidatoNome: string;
  vagaId?: string;
  candidatoId?: string;
}) => {
  const [mensagem, setMensagem] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [attachmentError, setAttachmentError] = useState("");
  const [sending, setSending] = useState(false);
  const { profile } = useAuth();

  if (!isOpen) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setAttachmentError("");
    setAttachmentFiles(files.slice(0, 2));
  };

  const removeAttachment = (index: number) => {
    setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSend = async () => {
    if ((!mensagem.trim() && attachmentFiles.length === 0) || !profile?.uid)
      return;
    setSending(true);
    try {
      let finalVagaId = vagaId;
      let finalCandidatoId = candidatoId;

      if (!finalVagaId || !finalCandidatoId) {
        const { data: candData } = await supabase
          .from("candidaturas")
          .select("vaga_id, candidato_id")
          .eq("id", candidaturaId)
          .maybeSingle();

        if (candData) {
          finalVagaId = candData.vaga_id;
          finalCandidatoId = candData.candidato_id;
        }
      }

      if (!finalVagaId || !finalCandidatoId) {
        throw new Error(
          "Não foi possível vincular a mensagem a uma vaga ou candidato.",
        );
      }

      let uploadedAttachments: any[] = [];

      if (attachmentFiles.length > 0) {
        try {
          uploadedAttachments = await uploadFiles(attachmentFiles);
        } catch (error) {
          console.error("Erro ao enviar anexos:", error);
          setAttachmentError("Não foi possível enviar os anexos.");
          throw error;
        }
      }

      const remetenteId = profile.id || profile.uid;

      const { error: messageError } = await supabase.from("mensagens").insert({
        id: crypto.randomUUID(),
        candidatura_id: candidaturaId,
        remetente_id: remetenteId,
        texto: mensagem,
        anexos: uploadedAttachments,
        criado_em: new Date().toISOString(),
        created_at: new Date().toISOString(),
        tamanho_total: uploadedAttachments.reduce(
          (total: number, item: any) =>
            total + Number(item.size || item.tamanho || 0),
          0,
        ),
      });

      if (messageError) throw messageError;

      try {
        const { data: configData } = await supabase
          .from("settings")
          .select("*")
          .eq("id", "email")
          .maybeSingle();

        const settings = configData?.data || configData || {};
        const { data: vagaData } = await supabase
          .from("vagas")
          .select("titulo")
          .eq("id", finalVagaId)
          .maybeSingle();

        const { data: userDoc } = await supabase
          .from("users")
          .select("nome, email")
          .eq("id", finalCandidatoId)
          .maybeSingle();

        const candidatoNome = userDoc?.nome || "Candidato";
        const candidatoEmail = userDoc?.email;
        const vagaTitulo = vagaData?.titulo || "Vaga";
        const rhEmail = profile?.email || settings.smtpUser || "";

        if (candidatoEmail) {
          const subject = (
            settings.emailTemplateSubject ||
            "Nova Mensagem do RH - [Título da Vaga]"
          )
            .replace("[Nome do Candidato]", candidatoNome)
            .replace("[Título da Vaga]", vagaTitulo)
            .replace("[Nome do RH]", profile?.nome || "RH")
            .replace("[Email do RH]", rhEmail);

          const body = (
            settings.emailTemplateBody ||
            "Olá [Nome do Candidato],\n\nVocê tem uma nova mensagem do RH referente à vaga [Título da Vaga].\n\nMensagem:\n[Mensagem do Convite]\n\nAtenciosamente,\n[Nome do RH]\n[Email do RH]"
          )
            .replace("[Nome do Candidato]", candidatoNome)
            .replace("[Título da Vaga]", vagaTitulo)
            .replace("[Nome do RH]", profile?.nome || "RH")
            .replace("[Email do RH]", rhEmail)
            .replace("[Mensagem do Convite]", mensagem);

          await safeFetch("/api/send-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              to: candidatoEmail,
              subject,
              body,
              smtpConfig: {
                smtpHost: settings.smtpHost,
                smtpPort: settings.smtpPort,
                smtpUser: settings.smtpUser,
                smtpPass: settings.smtpPass,
              },
            }),
          });
        }
      } catch (emailError) {
        console.warn(
          "Falha não bloqueante ao enfileirar e-mail da mensagem:",
          emailError,
        );
      }

      setMensagem("");
      setAttachmentFiles([]);
      setAttachmentError("");
      onClose();
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col">
        <div className="p-6 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <MessageCircle className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">
              Enviar Mensagem
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-600 mb-4">
            Envie uma mensagem para <strong>{candidatoNome}</strong>. O
            candidato receberá um e-mail de notificação e poderá responder pelo
            portal.
          </p>

          <textarea
            value={mensagem}
            onChange={(e) => setMensagem(e.target.value)}
            placeholder="Digite sua mensagem aqui..."
            rows={6}
            className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary resize-y min-h-[140px]"
          />

          <div className="mt-4">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Anexos
            </label>
            <input
              type="file"
              multiple
              onChange={handleFileSelect}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
            />
            {attachmentError && (
              <p className="text-xs text-red-600 mt-2">{attachmentError}</p>
            )}
            {attachmentFiles.length > 0 && (
              <div className="mt-3 space-y-2">
                {attachmentFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${index}`}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {file.type.startsWith("image/") ? (
                        <ImageIcon className="w-4 h-4 text-blue-500 shrink-0" />
                      ) : (
                        <FileText className="w-4 h-4 text-slate-500 shrink-0" />
                      )}
                      <span className="text-sm text-slate-700 truncate">
                        {file.name}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      className="text-slate-400 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-end items-center gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-white border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            disabled={sending}
          >
            Cancelar
          </button>
          <button
            onClick={handleSend}
            disabled={
              (!mensagem.trim() && attachmentFiles.length === 0) || sending
            }
            className="px-4 py-2 bg-primary text-white rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {sending ? "Enviando..." : "Enviar Mensagem"}
          </button>
        </div>
      </div>
    </div>
  );
};

export function HREntrevistas() {
  const { profile } = useAuth();
  const [selectedVaga, setSelectedVaga] = useState<string | null>(null);
  const [vagas, setVagas] = useState<any[]>([]);
  const [entrevistas, setEntrevistas] = useState<any[]>([]);
  const [candidaturasData, setCandidaturasData] = useState<any[]>([]);
  const [usersDataState, setUsersDataState] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting and filtering state for Vagas table
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>(
    {},
  );
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(
    null,
  );
  const [historyModal, setHistoryModal] = useState<{
    isOpen: boolean;
    nome: string;
    id?: string;
  }>({ isOpen: false, nome: "" });
  const [messageModal, setMessageModal] = useState<{
    isOpen: boolean;
    candidaturaId: string;
    candidatoNome: string;
    vagaId?: string;
    candidatoId?: string;
  }>({ isOpen: false, candidaturaId: "", candidatoNome: "" });
  const [selectedCandidato, setSelectedCandidato] = useState<any>(null);
  const [selectedCandidaturaId, setSelectedCandidaturaId] = useState<
    string | null
  >(null);
  const [hrUsers, setHrUsers] = useState<any[]>([]);

  const fetchData = async () => {
    try {
      const [vagasRes, candidaturasRes, usersRes] = await Promise.all([
        supabase.from("vagas").select("*, provas(nome)"),
        supabase.from("candidaturas").select("*"),
        supabase.from("users").select("*").eq("perfil", "RH"),
      ]);

      const hrUsersData = usersRes.data || [];
      setHrUsers(hrUsersData);

      const candidaturas = candidaturasRes.data || [];
      setCandidaturasData(candidaturas);

      const processStages = [
        "Entrevista RH",
        "Prova",
        "Entrevista Gestor",
        "Proposta",
        "Documentação",
        "Exame Médico",
      ];

      const vagasData = (vagasRes.data || [])
        .map((vData) => {
          const candidaturasDaVaga = candidaturas.filter(
            (c) => c.vaga_id === vData.id,
          );

          const candidaturasNoProcesso = candidaturasDaVaga.filter((c) => {
            const fase = c.fase ?? "Triagem";
            const status = c.status ?? "ATIVO";
            return processStages.includes(fase) && status !== "REPROVADA";
          });

          const eCount = candidaturasNoProcesso.length;
          const novidadesCount = candidaturasNoProcesso.filter(
            (c) => c.rh_visualizou_recrutamento !== true,
          ).length;

          let computedFase = "-";
          let maxIndex = -1;

          if (eCount > 0) {
            candidaturasNoProcesso.forEach((c) => {
              const fase = c.fase ?? "Triagem";
              const index = processStages.indexOf(fase);
              if (index > maxIndex) {
                maxIndex = index;
                computedFase = fase;
              }
            });
          }

          return {
            ...vData,
            id: vData.id,
            codigo_vaga: vData.codigo_vaga || null,
            cargo: vData.titulo,
            criadaEm: vData.created_at || "",
            dataFechamento: vData.data_fechamento || vData.closed_at || "",
            status: vData.status,
            faseAtual: vData.fase_atual || computedFase,
            exigeProva: vData.exige_prova,
            entrevistas: eCount,
            novidades: novidadesCount,
            ownerId: vData.owner_id,
          };
        })
        .filter((v) => v.entrevistas > 0);
      setVagas(vagasData);
    } catch (error) {
      console.error("Erro ao buscar dados:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!selectedVaga || !candidaturasData.length) return;

    const processStages = [
      "Entrevista RH",
      "Prova",
      "Entrevista Gestor",
      "Proposta",
      "Documentação",
      "Exame Médico",
    ];

    const candidaturasDaVaga = candidaturasData.filter(
      (c) => c.vaga_id === selectedVaga,
    );

    const candidaturasNoProcesso = candidaturasDaVaga.filter((c) => {
      const fase = (c.fase ?? "Triagem").trim();
      const status = c.status ?? "ATIVO";

      return processStages.includes(fase) && status !== "REPROVADA";
    });

    const fetchUsersAndSet = async () => {
      const candidatoIds = Array.from(
        new Set(candidaturasNoProcesso.map((c) => c.candidato_id)),
      );

      const { data: usersData } = await supabase
        .from("users")
        .select("*")
        .in("id", candidatoIds);

      const fullCandData = candidaturasNoProcesso.map((cData) => {
        const userData =
          (usersData || []).find((u) => u.id === cData.candidato_id) || {};
        const resumeData = userData.resume_data || {};
        const fallbackNome =
          userData.nome ||
          resumeData.nome ||
          resumeData.nomeCompleto ||
          (userData.email ? userData.email.split("@")[0] : "Sem Nome");

        return {
          id: cData.id,
          vagaId: cData.vaga_id,
          candidatoId: cData.candidato_id,
          fase: cData.fase,
          status: cData.status,
          nome: fallbackNome,
          email: userData.email,
          resumeData,
          rhVisualizouRecrutamento: cData.rh_visualizou_recrutamento,
        };
      });

      setEntrevistas(fullCandData);
    };

    fetchUsersAndSet();
  }, [selectedVaga, candidaturasData]);

  const handleSave = async (
    id: string,
    fase: string,
    status: string,
    observacoes: string,
    dataEntrevista: string,
    motivoDeclinio?: string,
    multiploRH?: boolean,
    colaboradoresRH?: string[],
  ) => {
    try {
      const vagaConfig = vagas.find((v) => v.id === selectedVaga);

      const { data: currentData, error: fetchError } = await supabase
        .from("candidaturas")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (fetchError || !currentData) return;

      const candidatura = entrevistas.find((e) => e.id === id);
      const vaga = vagas.find((v) => v.id === selectedVaga);

      let nextFase = fase;
      let nextStatus = currentData.status ?? "ATIVO";

      if (status === "Aprovado" || status === "Pular") {
        nextFase = getProximaFase(fase, vagaConfig);
        nextStatus =
          nextFase === "Contratado"
            ? "APROVADA"
            : (currentData.status ?? "ATIVO");
      } else if (status === "Reprovado") {
        if (["Exame"].includes(fase)) {
          nextFase = "Entrevista RH";
        } else {
          nextStatus = "REPROVADA";
        }
      }

      if (nextFase === "Contratado") nextStatus = "Contratado";
      if (nextStatus === "REPROVADA") nextFase = "Encerrado";

      const payload = {
        fase: nextFase,
        status: nextStatus,
        visualizado: true,
        updated_at: new Date().toISOString(),
      };

      await supabase.auth.refreshSession();

      const { data, error: updateError } = await supabase.rpc(
        "rpc_atualizar_candidatura_processo",
        {
          p_id: id,
          p_fase: payload.fase,
          p_status: payload.status,
          p_visualizado: payload.visualizado,
          p_updated_at: payload.updated_at,
        },
      );

      if (updateError) throw updateError;

      // Registrar evento de histórico
      let eventDesc = `Candidato movido para a fase: ${nextFase}${status ? " (Status: " + status + ")" : ""}`;
      if (observacoes) eventDesc += ` | Obs: ${observacoes}`;
      if (dataEntrevista)
        eventDesc += ` | Data: ${formatDateTime(dataEntrevista)}`;

      await logCandidaturaEvento(id, "FASE", eventDesc, profile?.id);

      alert("Informações salvas com sucesso!");

      await fetchData();

      // Manually reset DOM elements if moving to a new phase
      if (nextStatus !== fase) {
        const statusEl = document.getElementById(
          `status-${id}`,
        ) as HTMLSelectElement;
        const obsEl = document.getElementById(`obs-${id}`) as HTMLInputElement;
        const dataEl = document.getElementById(
          `data-${id}`,
        ) as HTMLInputElement;
        const motivoEl = document.getElementById(
          `motivo-${id}`,
        ) as HTMLSelectElement;
        const multiploEl = document.getElementById(
          `multiplo-rh-${id}`,
        ) as HTMLSelectElement;
        const colabEl = document.getElementById(
          `colaboradores-rh-${id}`,
        ) as HTMLSelectElement;
        const colabContainer = document.getElementById(
          `colaboradores-container-${id}`,
        );

        if (statusEl) statusEl.value = "Pendente";
        if (obsEl) obsEl.value = "";
        if (dataEl) dataEl.value = "";
        if (motivoEl) motivoEl.value = "";
        if (multiploEl) multiploEl.value = "Não";
        if (colabEl) {
          Array.from(colabEl.options).forEach((opt) => (opt.selected = false));
        }
        if (colabContainer) colabContainer.style.display = "none";
      }

      try {
        await logAudit(
          "Atualizou Entrevista",
          "Entrevistas",
          `Candidato ${candidatura?.nome} atualizado para ${nextStatus} (${status}).`,
        );
      } catch (logError) {
        console.warn("Erro ao registrar log:", logError);
      }
    } catch (error) {
      console.error("Erro ao salvar:", error);
      alert("Erro ao salvar informações.");
    }
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleColumnFilterChange = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filteredVagas = vagas
    .filter((vaga) => {
      const matchesSearch = vaga.cargo
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      for (const [key, value] of Object.entries(columnFilters)) {
        if (!value) continue;

        let itemValue = String(
          vaga[key as keyof typeof vaga] || "",
        ).toLowerCase();
        if (key === "criadaEm") {
          itemValue = formatDateTime(vaga.criadaEm).toLowerCase();
        } else if (key === "dataFechamento") {
          itemValue = vaga.dataFechamento
            ? formatDateTime(vaga.dataFechamento).toLowerCase()
            : "-";
        }

        if (!itemValue.includes(String(value).toLowerCase())) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      // Sort by novidades first
      if ((a.novidades || 0) > 0 && !(b.novidades > 0)) return -1;
      if (!(a.novidades > 0) && (b.novidades || 0) > 0) return 1;

      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;

      let aValue: any = a[key as keyof typeof a];
      let bValue: any = b[key as keyof typeof b];

      if (key === "criadaEm") {
        aValue = new Date(a.criadaEm).getTime();
        bValue = new Date(b.criadaEm).getTime();
      } else if (key === "dataFechamento") {
        aValue = a.dataFechamento ? new Date(a.dataFechamento).getTime() : 0;
        bValue = b.dataFechamento ? new Date(b.dataFechamento).getTime() : 0;
      } else {
        aValue = String(aValue || "").toLowerCase();
        bValue = String(bValue || "").toLowerCase();
      }

      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3 h-3 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary" />
    );
  };

  const renderFilterInput = (key: string, label: string) => {
    return (
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => handleSort(key)}
        >
          <span>{label}</span>
          <div className="flex items-center gap-1">
            {renderSortIcon(key)}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterColumn(activeFilterColumn === key ? null : key);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? "text-primary" : "text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"}`}
              title="Filtrar coluna"
            >
              <Filter className="w-3 h-3" />
            </button>
          </div>
        </div>
        {activeFilterColumn === key && (
          <input
            type="text"
            placeholder={`Filtrar...`}
            value={columnFilters[key] || ""}
            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-2 py-1 text-xs font-normal border border-slate-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          />
        )}
      </div>
    );
  };

  const filteredEntrevistas = selectedVaga
    ? entrevistas
        .filter((e) => e.vagaId === selectedVaga)
        .sort((a, b) => {
          if (
            a.rhVisualizouRecrutamento !== true &&
            b.rhVisualizouRecrutamento === true
          )
            return -1;
          if (
            a.rhVisualizouRecrutamento === true &&
            b.rhVisualizouRecrutamento !== true
          )
            return 1;
          return 0;
        })
    : [];

  if (selectedVaga) {
    const vaga = vagas.find((v) => v.id === selectedVaga);
    const isOwnerOrAdmin =
      profile?.perfil === "Admin" || vaga?.ownerId === profile?.uid;

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSelectedVaga(null)}
              className="text-slate-500 hover:text-slate-900"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900">
              Agenda RH: {vaga?.cargo}
            </h2>
          </div>
          {!isOwnerOrAdmin && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-lg text-sm flex items-center gap-2">
              <Info className="w-4 h-4" />
              Somente o proprietário da vaga pode realizar alterações no
              processo seletivo.
            </div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Candidato</th>
                <th className="px-6 py-4">Fase Atual</th>
                <th className="px-6 py-4">Data</th>
                <th className="px-6 py-4">Aprovação</th>
                <th className="px-6 py-4">Comentários</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEntrevistas.map((entrevista) => {
                const vagaConfig = vagas.find((v) => v.id === selectedVaga);

                // Determine values based on current status
                const currentFase = entrevista.fase ?? "Triagem";

                const isRH = currentFase === "Entrevista RH";
                const isGestor = currentFase === "Entrevista Gestor";
                const isProposta = currentFase === "Proposta";
                const isDocumentos = currentFase === "Entregar Documentação";
                const isExame = currentFase === "Exame";

                const currentAprovacao = "Pendente";
                const currentObs = "";
                const currentData = "";

                const isLocked =
                  currentAprovacao &&
                  currentAprovacao !== "Pendente" &&
                  !isProposta &&
                  !isDocumentos &&
                  !isExame;
                // For Proposta, Documentos, Exame, we only lock if it's finalized (Approved/Rejected)
                const isPropostaLocked =
                  isProposta && currentAprovacao !== "Pendente";
                const isDocumentosLocked =
                  isDocumentos && currentAprovacao !== "Pendente";
                const isExameLocked =
                  isExame && currentAprovacao !== "Pendente";
                const finalLocked =
                  isLocked ||
                  isPropostaLocked ||
                  isDocumentosLocked ||
                  isExameLocked ||
                  !isOwnerOrAdmin;

                return (
                  <tr
                    key={`${entrevista.id}-${currentFase}`}
                    className={`hover:bg-slate-50 transition-colors ${entrevista.rhVisualizouRecrutamento !== true ? "bg-orange-50/50 cursor-pointer" : ""}`}
                    onClick={async () => {
                      // rh_visualizou_recrutamento removed as it doesn't exist in DB
                    }}
                  >
                    <td className="px-6 py-4 font-medium text-slate-900">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span>{entrevista.nome}</span>
                          {entrevista.rhVisualizouRecrutamento !== true && (
                            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wider">
                              Novo
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <button
                            onClick={() =>
                              setHistoryModal({
                                isOpen: true,
                                nome: entrevista.nome,
                                id: entrevista.id,
                              })
                            }
                            className="text-[10px] text-primary hover:underline flex items-center gap-1"
                          >
                            <History className="w-3 h-3" /> Ver Histórico
                          </button>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-lg text-xs font-medium ${
                          isRH
                            ? "bg-blue-100 text-blue-700"
                            : isGestor
                              ? "bg-purple-100 text-purple-700"
                              : isProposta
                                ? "bg-amber-100 text-amber-700"
                                : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {currentFase}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <input
                        id={`data-${entrevista.id}`}
                        type="date"
                        defaultValue={currentData}
                        className="bg-transparent border-b border-slate-300 focus:outline-none focus:border-primary pb-1 disabled:opacity-50"
                        disabled={finalLocked}
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <select
                          id={`status-${entrevista.id}`}
                          className="bg-transparent border-b border-slate-300 focus:outline-none focus:border-primary pb-1 disabled:opacity-50"
                          defaultValue={currentAprovacao}
                          disabled={finalLocked}
                          onChange={(e) => {
                            const motivoDiv = document.getElementById(
                              `motivo-container-${entrevista.id}`,
                            );
                            if (motivoDiv) {
                              motivoDiv.style.display =
                                isProposta && e.target.value === "Reprovado"
                                  ? "block"
                                  : "none";
                            }
                          }}
                        >
                          <option value="Pendente">Pendente</option>
                          <option value="Aprovado">
                            {isProposta
                              ? "Aceitou"
                              : isDocumentos
                                ? "Entregue"
                                : "Aprovado"}
                          </option>
                          <option value="Reprovado">
                            {isProposta ? "Recusou" : "Reprovado"}
                          </option>
                          <option value="Pular">Não Aplicável (Pular)</option>
                        </select>

                        {isProposta && (
                          <div
                            id={`motivo-container-${entrevista.id}`}
                            style={{ display: "none" }}
                            className="mt-2"
                          >
                            <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                              Motivo do Declínio
                            </label>
                            <select
                              id={`motivo-${entrevista.id}`}
                              className="text-xs bg-slate-50 border border-slate-200 rounded p-1 w-full focus:outline-none focus:border-primary"
                              defaultValue={""}
                              disabled={finalLocked}
                            >
                              <option value="">Selecione...</option>
                              <option value="Salário">Salário</option>
                              <option value="Benefícios">Benefícios</option>
                              <option value="Modelo de Trabalho">
                                Modelo de Trabalho
                              </option>
                              <option value="Outros">Outros</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        <input
                          id={`obs-${entrevista.id}`}
                          type="text"
                          defaultValue={currentObs}
                          placeholder="Adicionar comentário..."
                          className="w-full bg-transparent border-b border-slate-300 focus:outline-none focus:border-primary pb-1 disabled:opacity-50"
                          disabled={finalLocked}
                        />
                        {isRH && (
                          <div className="mt-2 flex flex-col gap-2">
                            <label className="text-[10px] text-slate-500 uppercase font-bold">
                              Entrevista realizada com mais de um colaborador do
                              RH?
                            </label>
                            <select
                              id={`multiplo-rh-${entrevista.id}`}
                              className="text-xs bg-slate-50 border border-slate-200 rounded p-1 w-full focus:outline-none focus:border-primary"
                              defaultValue={"Não"}
                              disabled={finalLocked}
                              onChange={(e) => {
                                const colabDiv = document.getElementById(
                                  `colaboradores-container-${entrevista.id}`,
                                );
                                if (colabDiv) {
                                  colabDiv.style.display =
                                    e.target.value === "Sim" ? "block" : "none";
                                }
                              }}
                            >
                              <option value="Não">Não</option>
                              <option value="Sim">Sim</option>
                            </select>

                            <div
                              id={`colaboradores-container-${entrevista.id}`}
                              style={{ display: "none" }}
                            >
                              <label className="text-[10px] text-slate-500 uppercase font-bold block mb-1">
                                Colaboradores participantes
                              </label>
                              <select
                                id={`colaboradores-rh-${entrevista.id}`}
                                multiple
                                className="text-xs bg-slate-50 border border-slate-200 rounded p-1 w-full focus:outline-none focus:border-primary h-20"
                                defaultValue={[]}
                                disabled={finalLocked}
                              >
                                {hrUsers.map((user) => (
                                  <option key={user.id} value={user.id}>
                                    {user.nome || user.email}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex flex-col items-center gap-2">
                        {!finalLocked ? (
                          <button
                            className="text-primary hover:text-accent font-medium text-sm flex items-center gap-1 mx-auto"
                            onClick={() => {
                              const status = (
                                document.getElementById(
                                  `status-${entrevista.id}`,
                                ) as HTMLSelectElement
                              ).value;
                              const obs = (
                                document.getElementById(
                                  `obs-${entrevista.id}`,
                                ) as HTMLInputElement
                              ).value;
                              const data = (
                                document.getElementById(
                                  `data-${entrevista.id}`,
                                ) as HTMLInputElement
                              ).value;
                              const motivo = isProposta
                                ? (
                                    document.getElementById(
                                      `motivo-${entrevista.id}`,
                                    ) as HTMLSelectElement
                                  )?.value
                                : undefined;

                              if (!data) {
                                alert(
                                  "A data é obrigatória para registrar a etapa.",
                                );
                                return;
                              }

                              if (status === "Pendente") {
                                alert(
                                  "Selecione um status (Aprovado, Reprovado ou Pular) para registrar a etapa.",
                                );
                                return;
                              }

                              let multiploRH = undefined;
                              let colaboradoresRH = undefined;

                              if (isRH) {
                                const multiploSelect = document.getElementById(
                                  `multiplo-rh-${entrevista.id}`,
                                ) as HTMLSelectElement;
                                multiploRH = multiploSelect?.value === "Sim";

                                if (multiploRH) {
                                  const colabSelect = document.getElementById(
                                    `colaboradores-rh-${entrevista.id}`,
                                  ) as HTMLSelectElement;
                                  if (colabSelect) {
                                    colaboradoresRH = Array.from(
                                      colabSelect.selectedOptions,
                                    ).map((opt) => opt.value);
                                  }
                                }
                              }

                              handleSave(
                                entrevista.id,
                                currentFase,
                                status,
                                obs,
                                data,
                                motivo,
                                multiploRH,
                                colaboradoresRH,
                              );
                            }}
                          >
                            <Save className="w-4 h-4" /> Salvar
                          </button>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium uppercase">
                            Finalizado
                          </span>
                        )}
                        <button
                          onClick={() => {
                            const candData = {
                              id: entrevista.candidato_id,
                              nome: entrevista.nome,
                              email: entrevista.email,
                              resumeData: entrevista.resumeData || {},
                            };
                            setSelectedCandidato(candData);
                            setSelectedCandidaturaId(entrevista.id);
                          }}
                          className="text-primary hover:text-accent text-xs font-medium transition-colors flex items-center gap-1 justify-center w-full"
                        >
                          <Eye className="w-4 h-4" /> Ver Candidato
                        </button>
                        <button
                          onClick={() =>
                            setMessageModal({
                              isOpen: true,
                              candidaturaId: entrevista.id,
                              candidatoNome: entrevista.nome,
                              vagaId: entrevista.vaga_id,
                              candidatoId: entrevista.candidato_id,
                            })
                          }
                          className="text-slate-500 hover:text-primary text-xs font-medium transition-colors flex items-center gap-1 justify-center w-full"
                        >
                          <MessageCircle className="w-4 h-4" /> Mensagem
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <HistoryModal
          isOpen={historyModal.isOpen}
          onClose={() => setHistoryModal({ ...historyModal, isOpen: false })}
          nomeCandidato={historyModal.nome}
          candidaturaId={historyModal.id}
        />

        <SendMessageModal
          isOpen={messageModal.isOpen}
          onClose={() => setMessageModal({ ...messageModal, isOpen: false })}
          candidaturaId={messageModal.candidaturaId}
          candidatoNome={messageModal.candidatoNome}
          vagaId={messageModal.vagaId}
          candidatoId={messageModal.candidatoId}
        />

        {selectedCandidato && (
          <CandidateProfileModal
            candidato={selectedCandidato}
            candidaturaId={selectedCandidaturaId || undefined}
            vaga={vaga}
            onActionComplete={fetchData}
            showDecisionActions={false}
            onClose={() => {
              setSelectedCandidato(null);
              setSelectedCandidaturaId(null);
            }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">
          Processo de Recrut/Selec por Vaga
        </h2>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 w-full max-w-md">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Buscar vagas..."
            className="w-full px-2 py-1 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-1/12">
                  {renderFilterInput("codigo_vaga", "Código")}
                </th>
                <th className="px-6 py-4 w-1/4">
                  {renderFilterInput("cargo", "Vaga")}
                </th>
                <th className="px-6 py-4 w-1/6">
                  {renderFilterInput("criadaEm", "Data de Abertura")}
                </th>
                <th className="px-6 py-4 w-1/6">
                  {renderFilterInput("dataFechamento", "Data de Fechamento")}
                </th>
                <th className="px-6 py-4 w-1/6">
                  {renderFilterInput("status", "Status da Vaga")}
                </th>
                <th className="px-6 py-4 w-1/6">
                  {renderFilterInput("faseAtual", "Fase Atual do Processo")}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVagas.map((vaga) => (
                <tr
                  key={vaga.id}
                  onClick={() => setSelectedVaga(vaga.id)}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${vaga.novidades > 0 ? "bg-orange-50/50" : ""}`}
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {vaga.codigo_vaga || "-"}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {vaga.cargo}
                      {vaga.novidades > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full">
                          {vaga.novidades > 99 ? "99+" : vaga.novidades}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">{formatDateTime(vaga.criadaEm)}</td>
                  <td className="px-6 py-4">
                    {vaga.dataFechamento
                      ? formatDateTime(vaga.dataFechamento)
                      : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        vaga.status === "Aberta"
                          ? "bg-emerald-100 text-emerald-700"
                          : vaga.status === "Pausada"
                            ? "bg-amber-100 text-amber-700"
                            : vaga.status === "Encerrada"
                              ? "bg-slate-100 text-slate-700"
                              : "bg-red-100 text-red-700"
                      }`}
                    >
                      {vaga.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-primary">
                    {vaga.faseAtual}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function HRMensagens() {
  const { profile } = useAuth();
  const [selectedVaga, setSelectedVaga] = useState<string | null>(null);
  const [selectedCandidaturaId, setSelectedCandidaturaId] = useState<
    string | null
  >(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isCandidatesPanelOpen, setIsCandidatesPanelOpen] = useState(false);
  const [vagas, setVagas] = useState<any[]>([]);
  const [candidaturas, setCandidaturas] = useState<any[]>([]);
  const [mensagens, setMensagens] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const chatMessagesEndRef = useRef<HTMLDivElement | null>(null);

  // Sorting and filtering state for Vagas table
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>(
    {},
  );
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const fetchVagas = async () => {
      try {
        const [vagasRes, candidaturasRes, mensagensRes] = await Promise.all([
          supabase.from("vagas").select("*, provas(nome)"),
          supabase.from("candidaturas").select("*"),
          supabase
            .from("mensagens")
            .select(
              "id, candidatura_id, texto, anexos, remetente_id, created_at, criado_em",
            )
            .order("criado_em", { ascending: false }),
        ]);

        const candidaturas = candidaturasRes.data || [];
        const todasMensagens = (mensagensRes.data || []).map((m: any) => ({
          ...m,
          mensagem: m.texto || "",
          created_at: m.criado_em || m.created_at || null,
        }));

        const vagasData = (vagasRes.data || []).map((vData) => {
          const candidaturasDaVaga = candidaturas.filter(
            (c) => c.vaga_id === vData.id,
          );
          const novidadesCount = candidaturasDaVaga.reduce(
            (acc, c) => acc + (c.unread_messages_by_hr || 0),
            0,
          );

          // Encontrar a última mensagem desta vaga (de qualquer candidato)
          const ultimaMensagemVaga = todasMensagens.find((m) =>
            candidaturasDaVaga.some((c) => c.id === m.candidatura_id),
          );

          return {
            ...vData,
            id: vData.id,
            codigo_vaga: vData.codigo_vaga || null,
            cargo: vData.titulo,
            criadaEm: vData.created_at || "",
            dataFechamento: vData.data_fechamento || vData.closed_at || "",
            status: vData.status,
            novidades: novidadesCount,
            ultimaMensagem: ultimaMensagemVaga
              ? ultimaMensagemVaga.mensagem
              : "Sem mensagens",
            ultimaMensagemData: ultimaMensagemVaga
              ? ultimaMensagemVaga.created_at
              : null,
            ownerId: vData.owner_id,
          };
        });

        // Ordenar vagas que tem novidades primeiro, depois pela data da última mensagem
        vagasData.sort((a, b) => {
          if (a.novidades > 0 && b.novidades === 0) return -1;
          if (a.novidades === 0 && b.novidades > 0) return 1;

          const dateA = a.ultimaMensagemData
            ? new Date(a.ultimaMensagemData).getTime()
            : 0;
          const dateB = b.ultimaMensagemData
            ? new Date(b.ultimaMensagemData).getTime()
            : 0;
          return dateB - dateA;
        });

        setVagas(vagasData);
      } catch (error) {
        console.error("Erro ao buscar vagas:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchVagas();

    // Subscribe to messages to update the list
    const channel = supabase
      .channel("public:mensagens_vagas")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "mensagens" },
        () => {
          fetchVagas();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    if (!selectedVaga) {
      setCandidaturas([]);
      setSelectedCandidaturaId(null);
      return;
    }

    setSelectedCandidaturaId(null); // Reset when changing vaga

    const fetchCandidaturas = async () => {
      const { data: candidaturasData, error } = await supabase
        .from("candidaturas")
        .select("*")
        .eq("vaga_id", selectedVaga);

      if (error) {
        console.error("Erro ao buscar candidaturas:", error);
        return;
      }

      const candidatoIds = Array.from(
        new Set(candidaturasData.map((c) => c.candidato_id)),
      );
      const { data: usersData } = await supabase
        .from("users")
        .select("id, nome")
        .in("id", candidatoIds);

      // Fetch last messages for these candidates in this vaga
      const { data: lastMessages } = await supabase
        .from("mensagens")
        .select(
          "id, candidatura_id, texto, anexos, remetente_id, created_at, criado_em",
        )
        .in(
          "candidatura_id",
          candidaturasData.map((c) => c.id),
        )
        .order("criado_em", { ascending: false });

      const fullCandidaturasData = candidaturasData.map((c) => {
        const lastMsg = lastMessages?.find((m) => m.candidatura_id === c.id);
        return {
          ...c,
          candidatoNome:
            usersData?.find((u) => u.id === c.candidato_id)?.nome ||
            "Candidato não encontrado",
          ultimaMensagem: lastMsg ? lastMsg.texto : "Sem mensagens",
          ultimaMensagemData: lastMsg
            ? lastMsg.criado_em || lastMsg.created_at
            : null,
        };
      });

      fullCandidaturasData.sort((a: any, b: any) => {
        const unreadA = a.unread_messages_by_hr || 0;
        const unreadB = b.unread_messages_by_hr || 0;
        if (unreadA !== unreadB) {
          return unreadB - unreadA;
        }
        const dateA = a.ultimaMensagemData
          ? new Date(a.ultimaMensagemData).getTime()
          : 0;
        const dateB = b.ultimaMensagemData
          ? new Date(b.ultimaMensagemData).getTime()
          : 0;
        if (dateA !== dateB) return dateB - dateA;
        return a.candidatoNome.localeCompare(b.candidatoNome);
      });

      setCandidaturas(fullCandidaturasData);
      if (fullCandidaturasData.length > 0 && !selectedCandidaturaId) {
        setSelectedCandidaturaId(fullCandidaturasData[0].id);
      } else if (fullCandidaturasData.length === 0) {
        setSelectedCandidaturaId(null);
      }
    };

    fetchCandidaturas();

    const channel = supabase
      .channel(`candidaturas-vaga-${selectedVaga}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "candidaturas",
          filter: `vaga_id=eq.${selectedVaga}`,
        },
        () => {
          fetchCandidaturas();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedVaga]);

  useEffect(() => {
    if (selectedCandidaturaId && isChatOpen) {
      const candidatura = candidaturas.find(
        (c) => c.id === selectedCandidaturaId,
      );
      if (candidatura && (candidatura.unread_messages_by_hr || 0) > 0) {
        const resetUnread = async () => {
          try {
            // unread_messages_by_hr removed as it doesn't exist in DB
            // .update({ unread_messages_by_hr: 0 })
            // .eq('id', selectedCandidaturaId);

            setVagas((prev) =>
              prev.map((v) =>
                v.id === selectedVaga
                  ? {
                      ...v,
                      novidades: Math.max(
                        0,
                        v.novidades - (candidatura.unread_messages_by_hr || 0),
                      ),
                    }
                  : v,
              ),
            );
          } catch (error) {
            console.error("Erro ao resetar mensagens não lidas:", error);
          }
        };
        resetUnread();
      }
    }
  }, [selectedCandidaturaId, isChatOpen, candidaturas]);

  useEffect(() => {
    if (!selectedCandidaturaId) {
      setMensagens([]);
      return;
    }

    const fetchMensagens = async () => {
      const candidatura = candidaturas.find(
        (c) => c.id === selectedCandidaturaId,
      );
      if (!candidatura) return;

      const { data, error } = await supabase
        .from("mensagens")
        .select(
          "id, candidatura_id, texto, anexos, remetente_id, created_at, criado_em",
        )
        .eq("candidatura_id", selectedCandidaturaId)
        .order("criado_em", { ascending: true });

      if (error) {
        console.error("Erro ao buscar mensagens:", error);
        return;
      }

      const activeProfileIds = [profile?.id, profile?.uid].filter(Boolean);

      setMensagens(
        (data || []).map((msg: any) => ({
          ...msg,
          mensagem: msg.texto || "",
          remetente: activeProfileIds.includes(msg.remetente_id)
            ? profile?.nome || "RH"
            : "Candidato",
          created_at: msg.criado_em || msg.created_at || null,
        })),
      );
    };

    fetchMensagens();

    const channel = supabase
      .channel(`mensagens-candidatura-${selectedCandidaturaId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "mensagens",
          filter: `candidatura_id=eq.${selectedCandidaturaId}`,
        },
        () => {
          fetchMensagens();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedCandidaturaId]);

  useEffect(() => {
    if (!isChatOpen) return;

    chatMessagesEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [mensagens, isChatOpen, selectedCandidaturaId]);

  const handleSendMessage = async (text: string, attachments: any[]) => {
    if (
      (!text.trim() && attachments.length === 0) ||
      !selectedCandidaturaId ||
      !profile?.uid ||
      !selectedVaga
    )
      return;

    const candidatura = candidaturas.find(
      (c) => c.id === selectedCandidaturaId,
    );
    if (!candidatura) return;

    try {
      const remetenteId = profile.id || profile.uid;

      const msgData: any = {
        id: crypto.randomUUID(),
        candidatura_id: selectedCandidaturaId,
        remetente_id: remetenteId,
        texto: text,
        criado_em: new Date().toISOString(),
        created_at: new Date().toISOString(),
        tamanho_total: 0,
      };

      if (attachments.length > 0) {
        msgData.anexos = attachments;
      }

      const { error: insertError } = await supabase
        .from("mensagens")
        .insert(msgData);

      if (insertError) throw insertError;

      setMensagens((prev) => [
        ...prev,
        {
          ...msgData,
          mensagem: msgData.texto || "",
          remetente: profile?.nome || "RH",
          created_at: msgData.criado_em || msgData.created_at || null,
        },
      ]);

      try {
        const { data: configData } = await supabase
          .from("settings")
          .select("*")
          .eq("id", "email")
          .maybeSingle();

        const settings = configData?.data || configData || {};
        const { data: candDoc } = await supabase
          .from("candidaturas")
          .select("vaga_id, candidato_id")
          .eq("id", selectedCandidaturaId)
          .maybeSingle();

        let vagaTitulo = "Vaga";
        let candidatoNome = "Candidato";
        let candidatoEmail = "";

        if (candDoc) {
          const { data: vagaDoc } = await supabase
            .from("vagas")
            .select("titulo")
            .eq("id", candDoc.vaga_id)
            .maybeSingle();
          if (vagaDoc) vagaTitulo = vagaDoc.titulo;

          const { data: userDoc } = await supabase
            .from("users")
            .select("nome, email")
            .eq("id", candDoc.candidato_id)
            .maybeSingle();

          if (userDoc) {
            candidatoNome = userDoc.nome || candidatoNome;
            candidatoEmail = userDoc.email || "";
          }
        }

        if (candidatoEmail) {
          const rhEmail = profile?.email || settings.smtpUser || "";
          const subject = (
            settings.emailTemplateSubject ||
            "Nova Mensagem do RH - [Título da Vaga]"
          )
            .replace("[Nome do Candidato]", candidatoNome)
            .replace("[Título da Vaga]", vagaTitulo)
            .replace("[Nome do RH]", profile?.nome || "RH")
            .replace("[Email do RH]", rhEmail);

          const body = (
            settings.emailTemplateBody ||
            "Olá [Nome do Candidato],\n\nVocê tem uma nova mensagem do RH referente à vaga [Título da Vaga].\n\nMensagem:\n[Mensagem do Convite]\n\nAtenciosamente,\n[Nome do RH]\n[Email do RH]"
          )
            .replace("[Nome do Candidato]", candidatoNome)
            .replace("[Título da Vaga]", vagaTitulo)
            .replace("[Nome do RH]", profile?.nome || "RH")
            .replace("[Email do RH]", rhEmail)
            .replace("[Mensagem do Convite]", text);

          try {
            await safeFetch("/api/send-email", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                to: candidatoEmail,
                subject,
                body,
                smtpConfig: {
                  smtpHost: settings.smtpHost,
                  smtpPort: settings.smtpPort,
                  smtpUser: settings.smtpUser,
                  smtpPass: settings.smtpPass,
                },
              }),
            });
          } catch (emailError) {
            console.warn(
              "Falha não bloqueante ao enviar e-mail da conversa:",
              emailError,
            );
          }
        }
      } catch (emailError) {
        console.warn(
          "Falha não bloqueante ao enfileirar e-mail da mensagem:",
          emailError,
        );
      }

      return;
      const { data: configData } = await supabase
        .from("settings")
        .select("*")
        .eq("id", "email")
        .maybeSingle();

      if (configData) {
        const settings = configData.data || configData;
        // Fetch candidatura to get vaga info
        const { data: candDoc } = await supabase
          .from("candidaturas")
          .select("vaga_id, candidato_id")
          .eq("id", selectedCandidaturaId)
          .maybeSingle();

        let vagaTitulo = "Vaga";
        let candidatoNome = "Candidato";
        if (candDoc) {
          const { data: vagaDoc } = await supabase
            .from("vagas")
            .select("titulo")
            .eq("id", candDoc.vaga_id)
            .maybeSingle();
          if (vagaDoc) {
            vagaTitulo = vagaDoc.titulo;
          }
          const { data: userDoc } = await supabase
            .from("users")
            .select("nome, email")
            .eq("id", candDoc.candidato_id)
            .maybeSingle();
          if (userDoc) {
            candidatoNome = userDoc.nome;
            const candidatoEmail = userDoc.email;

            const subject =
              settings.emailTemplateSubject
                ?.replace("[Nome do Candidato]", candidatoNome)
                ?.replace("[Título da Vaga]", vagaTitulo) ||
              "Nova Mensagem do RH";

            const body =
              settings.emailTemplateBody
                ?.replace("[Nome do Candidato]", candidatoNome)
                ?.replace("[Título da Vaga]", vagaTitulo) ||
              "Você tem uma nova mensagem do RH.";

            // Endpoint de e-mail indisponível neste ambiente: mantém apenas o envio interno da mensagem.
          }
        }
      }
    } catch (error) {
      console.error("Erro ao enviar mensagem:", error);
      alert("Erro ao enviar mensagem. Verifique as permissões.");
    }
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleColumnFilterChange = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filteredVagas = vagas
    .filter((vaga) => {
      const matchesSearch = vaga.cargo
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesColumnFilters = Object.entries(columnFilters).every(
        ([key, value]) => {
          if (!value) return true;
          let vagaValue = String(
            vaga[key as keyof typeof vaga] || "",
          ).toLowerCase();
          if (key === "criadaEm") {
            vagaValue = new Date(vaga.criadaEm)
              .toLocaleDateString("pt-BR")
              .toLowerCase();
          } else if (key === "dataFechamento") {
            vagaValue = vaga.dataFechamento
              ? new Date(vaga.dataFechamento)
                  .toLocaleDateString("pt-BR")
                  .toLowerCase()
              : "-";
          }
          return vagaValue.includes(String(value).toLowerCase());
        },
      );
      return matchesSearch && matchesColumnFilters;
    })
    .sort((a, b) => {
      // Sort by novidades first
      if ((a.novidades || 0) > 0 && !(b.novidades > 0)) return -1;
      if (!(a.novidades > 0) && (b.novidades || 0) > 0) return 1;

      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;

      let aValue: any = a[key as keyof typeof a];
      let bValue: any = b[key as keyof typeof b];

      if (key === "criadaEm") {
        aValue = new Date(a.criadaEm).getTime();
        bValue = new Date(b.criadaEm).getTime();
      } else if (key === "dataFechamento") {
        aValue = a.dataFechamento ? new Date(a.dataFechamento).getTime() : 0;
        bValue = b.dataFechamento ? new Date(b.dataFechamento).getTime() : 0;
      } else {
        aValue = String(aValue || "").toLowerCase();
        bValue = String(bValue || "").toLowerCase();
      }

      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3 h-3 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary" />
    );
  };

  const renderFilterInput = (key: string, label: string) => {
    return (
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => handleSort(key)}
        >
          <span>{label}</span>
          <div className="flex items-center gap-1">
            {renderSortIcon(key)}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterColumn(activeFilterColumn === key ? null : key);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? "text-primary" : "text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"}`}
              title="Filtrar coluna"
            >
              <Filter className="w-3 h-3" />
            </button>
          </div>
        </div>
        {activeFilterColumn === key && (
          <input
            type="text"
            placeholder={`Filtrar...`}
            value={columnFilters[key] || ""}
            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-2 py-1 text-xs font-normal border border-slate-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          />
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">Carregando...</div>
    );
  }

  if (!isChatOpen) {
    return (
      <div className="space-y-6 relative">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-slate-900">
            Mensagens por Vaga
          </h2>
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 w-full max-w-md">
            <Search className="w-5 h-5 text-slate-400 ml-2" />
            <input
              type="text"
              placeholder="Buscar vagas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-transparent border-none focus:outline-none text-slate-700 placeholder-slate-400"
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-1/12">
                  {renderFilterInput("codigo_vaga", "Código")}
                </th>
                <th className="px-6 py-4 w-1/4">
                  {renderFilterInput("cargo", "Vaga")}
                </th>
                <th className="px-6 py-4 w-1/6">
                  {renderFilterInput("criadaEm", "Data de Abertura")}
                </th>
                <th className="px-6 py-4 w-1/6">
                  {renderFilterInput("dataFechamento", "Encerrada em")}
                </th>
                <th className="px-6 py-4 w-1/6">
                  {renderFilterInput("status", "Status da Vaga")}
                </th>
                <th className="px-6 py-4 w-1/4">Última Mensagem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVagas.map((vaga) => (
                <tr
                  key={vaga.id}
                  className={`hover:bg-slate-50 transition-colors cursor-pointer ${vaga.novidades > 0 ? "bg-orange-50/50" : ""}`}
                  onClick={() => {
                    setSelectedVaga(vaga.id);
                    setIsCandidatesPanelOpen(true);
                  }}
                >
                  <td className="px-6 py-4 font-mono text-xs text-slate-500">
                    {vaga.codigo_vaga || "-"}
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <div className="flex items-center gap-2">
                      {vaga.cargo}
                      {vaga.novidades > 0 && (
                        <span className="flex items-center justify-center w-5 h-5 bg-orange-500 text-white text-[10px] font-bold rounded-full">
                          {vaga.novidades > 99 ? "99+" : vaga.novidades}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {new Date(vaga.criadaEm).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-6 py-4">
                    {vaga.dataFechamento
                      ? new Date(vaga.dataFechamento).toLocaleDateString(
                          "pt-BR",
                        )
                      : "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-lg text-xs font-medium ${
                        vaga.status === "Aberta"
                          ? "bg-emerald-100 text-emerald-700"
                          : vaga.status === "Encerrada"
                            ? "bg-rose-100 text-rose-700"
                            : vaga.status === "Pausada"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {vaga.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p
                      className="text-xs text-slate-500 truncate max-w-[200px]"
                      title={vaga.ultimaMensagem}
                    >
                      {vaga.ultimaMensagem}
                    </p>
                  </td>
                </tr>
              ))}
              {filteredVagas.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhuma vaga encontrada com os filtros atuais.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Side Panel for Candidates */}
        {isCandidatesPanelOpen && (
          <div
            className="fixed inset-0 z-50 flex justify-end bg-black/20"
            onClick={() => setIsCandidatesPanelOpen(false)}
          >
            <div
              className="w-96 bg-white h-full shadow-xl flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                <h3 className="font-bold text-slate-900">Candidatos da Vaga</h3>
                <button
                  onClick={() => setIsCandidatesPanelOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-slate-100 p-2">
                {candidaturas.map((c) => (
                  <div
                    key={c.id}
                    onClick={() => {
                      setSelectedCandidaturaId(c.id);
                      setIsCandidatesPanelOpen(false);
                      setIsChatOpen(true);
                    }}
                    className={`p-3 cursor-pointer rounded-lg transition-colors ${c.unreadMessagesByHR > 0 ? "bg-orange-50/50 hover:bg-orange-100/50" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <h4 className="font-medium text-slate-900 text-sm">
                          {c.candidatoNome}
                        </h4>
                        {c.unreadMessagesByHR > 0 && (
                          <span className="bg-orange-100 text-orange-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                            Novo{" "}
                            {c.unreadMessagesByHR > 1
                              ? `(${c.unreadMessagesByHR})`
                              : ""}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                        {c.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 truncate mt-1">
                      {c.ultimaMensagem}
                    </p>
                  </div>
                ))}
                {candidaturas.length === 0 && (
                  <div className="p-4 text-center text-slate-500 text-sm italic">
                    Nenhuma candidatura encontrada para esta vaga.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  const vagaAtiva = vagas.find((v) => v.id === selectedVaga);
  const candidaturaAtiva = candidaturas.find(
    (c) => c.id === selectedCandidaturaId,
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => {
            setIsChatOpen(false);
            setSelectedCandidaturaId(null);
            setSelectedVaga(null);
          }}
          className="text-slate-500 hover:text-slate-900"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-slate-900">
          Mensagens: {vagaAtiva?.cargo}
        </h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex h-[600px]">
        {/* Lista de conversas */}
        <div className="w-1/3 border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900">Candidatos</h3>
          </div>
          <div className="divide-y divide-slate-200 overflow-y-auto flex-1">
            {candidaturas.map((c) => (
              <div
                key={c.id}
                onClick={() => setSelectedCandidaturaId(c.id)}
                className={`p-4 cursor-pointer border-l-4 transition-colors ${selectedCandidaturaId === c.id ? "bg-primary/5 border-primary" : "hover:bg-slate-50 border-transparent"}`}
              >
                <div className="flex justify-between items-start">
                  <h4 className="font-bold text-slate-900 text-sm">
                    {c.candidatoNome}
                  </h4>
                  <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                    {c.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 truncate mt-1">
                  {c.ultimaMensagem}
                </p>
              </div>
            ))}
            {candidaturas.length === 0 && (
              <div className="p-4 text-center text-slate-500 text-sm italic">
                Nenhuma candidatura encontrada para esta vaga.
              </div>
            )}
          </div>
        </div>
        {/* Chat ativo */}
        {candidaturaAtiva ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-white">
              <h3 className="font-bold text-slate-900">
                {candidaturaAtiva.candidatoNome}
              </h3>
              <p className="text-xs text-slate-500">
                Status: {candidaturaAtiva.status}
              </p>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
              {mensagens.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.tipo === "SISTEMA" ? "justify-center" : msg.remetente === profile?.nome ? "justify-end" : "justify-start"}`}
                >
                  {msg.tipo === "SISTEMA" ? (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-2 rounded-lg text-xs font-medium max-w-[90%] text-center shadow-sm">
                      <div className="flex items-center justify-center gap-2 mb-1">
                        <AlertCircle className="w-3 h-3" />
                        <span className="uppercase tracking-wider opacity-70 text-[10px]">
                          Notificação do Sistema
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap">{msg.mensagem}</p>
                      <span className="block mt-1 opacity-50 text-[9px]">
                        {msg.created_at
                          ? new Date(msg.created_at).toLocaleString("pt-BR")
                          : ""}
                      </span>
                    </div>
                  ) : (
                    <div
                      className={`${msg.remetente === profile?.nome ? "bg-primary text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-700 rounded-tl-none"} rounded-lg p-3 max-w-[80%]`}
                    >
                      {msg.mensagem && (
                        <p className="text-sm whitespace-pre-wrap">
                          {msg.mensagem}
                        </p>
                      )}

                      {msg.anexos && msg.anexos.length > 0 && (
                        <div className="mt-2 space-y-2">
                          {msg.anexos.map((anexo: any, idx: number) => (
                            <div
                              key={idx}
                              className={`flex items-center gap-2 p-2 rounded border ${msg.remetente === profile?.nome ? "bg-primary-foreground/10 border-primary-foreground/20" : "bg-slate-50 border-slate-200"}`}
                            >
                              {String(
                                anexo?.tipo || anexo?.type || "",
                              ).startsWith("image/") ? (
                                <ImageIcon className="w-5 h-5 shrink-0" />
                              ) : (
                                <FileText className="w-5 h-5 shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p
                                  className="text-xs font-medium truncate"
                                  title={anexo?.nome || anexo?.name || "Anexo"}
                                >
                                  {anexo?.nome || anexo?.name || "Anexo"}
                                </p>
                                <p className="text-[10px] opacity-70">
                                  {(
                                    Number(anexo?.tamanho || anexo?.size || 0) /
                                    1024 /
                                    1024
                                  ).toFixed(2)}{" "}
                                  MB
                                </p>
                              </div>
                              <a
                                href={anexo?.url || anexo?.path || "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`p-1.5 rounded-full hover:bg-black/10 transition-colors shrink-0`}
                                title="Baixar arquivo"
                              >
                                <Download className="w-4 h-4" />
                              </a>
                            </div>
                          ))}
                        </div>
                      )}

                      <span
                        className={`text-[10px] mt-1 block ${msg.remetente === profile?.nome ? "text-primary-foreground/70 text-right" : "text-slate-400"}`}
                      >
                        {msg.created_at
                          ? new Date(msg.created_at).toLocaleTimeString(
                              "pt-BR",
                              { hour: "2-digit", minute: "2-digit" },
                            )
                          : ""}
                      </span>
                    </div>
                  )}
                </div>
              ))}
              {mensagens.length === 0 && (
                <div className="text-center text-slate-400 text-sm py-8">
                  Nenhuma mensagem nesta conversa.
                </div>
              )}
              <div ref={chatMessagesEndRef} />
            </div>
            <div className="p-4 border-t border-slate-200 bg-white">
              <ChatInput
                onSendMessage={handleSendMessage}
                placeholder="Digite sua mensagem para o candidato..."
                showAttachmentButton={true}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50 text-slate-400">
            Selecione um candidato para ver as mensagens.
          </div>
        )}
      </div>
    </div>
  );
}

export function HRBancoTalentos() {
  const { profile } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState<{
    key: string;
    direction: "asc" | "desc";
  } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>(
    {},
  );
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(
    null,
  );

  const [isConvidarModalOpen, setIsConvidarModalOpen] = useState(false);
  const [selectedTalentoId, setSelectedTalentoId] = useState<string | null>(
    null,
  );
  const [selectedVagaToConvidar, setSelectedVagaToConvidar] = useState<
    string | null
  >(null);
  const [selectedCandidato, setSelectedCandidato] = useState<any>(null);

  const [talentos, setTalentos] = useState<any[]>([]);
  const [vagasAbertas, setVagasAbertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [usersRes, candidaturasRes, vagasRes, logsRes] =
          await Promise.all([
            supabase.from("users").select("*").eq("perfil", "Candidato"),
            supabase.from("candidaturas").select("*"),
            supabase.from("vagas").select("*, provas(nome)"),
            supabase.from("logs").select("*").eq("acao", "Enviou Convite"),
          ]);

        const usersData = usersRes.data || [];
        const candidaturasData = candidaturasRes.data || [];
        const vagasData = vagasRes.data || [];
        const logsData = logsRes.data || [];

        const vagasDataMap = new Map();
        const vagasAbertasData: any[] = [];
        vagasData.forEach((data) => {
          vagasDataMap.set(data.id, data.titulo);
          if (data.status_vaga === "ABERTA" || data.status === "Aberta") {
            vagasAbertasData.push({
              id: data.id,
              cargo: data.titulo,
              ownerId: data.owner_id,
            });
          }
        });
        setVagasAbertas(vagasAbertasData);

        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const convitesPorCandidato = new Map();
        logsData.forEach((log) => {
          try {
            const detalhes = JSON.parse(log.detalhes);
            const createdAt = new Date(log.data || new Date());

            if (createdAt >= fifteenDaysAgo) {
              if (!convitesPorCandidato.has(detalhes.candidato_id)) {
                convitesPorCandidato.set(detalhes.candidato_id, []);
              }
              convitesPorCandidato.get(detalhes.candidato_id).push({
                vagaId: detalhes.vaga_id,
                vagaTitulo: detalhes.vaga_titulo || "Vaga",
                dataConvite: createdAt,
              });
            }
          } catch (e) {
            // Ignorar logs mal formatados
          }
        });

        const vagasPorId = new Map<string, any>();
        vagasData.forEach((vaga: any) => {
          vagasPorId.set(vaga.id, vaga);
        });

        const usersByCanonicalKey = new Map<string, any>();
        const userIdsByCanonicalKey = new Map<string, Set<string>>();
        const canonicalKeyByUserId = new Map<string, string>();

        usersData.forEach((data: any) => {
          const canonicalKey =
            data.email?.toLowerCase()?.trim() ||
            data.login_lower ||
            data.login ||
            data.uid ||
            data.id;

          canonicalKeyByUserId.set(data.id, canonicalKey);
          if (data.uid) {
            canonicalKeyByUserId.set(data.uid, canonicalKey);
          }

          if (!userIdsByCanonicalKey.has(canonicalKey)) {
            userIdsByCanonicalKey.set(canonicalKey, new Set());
          }
          userIdsByCanonicalKey.get(canonicalKey)?.add(data.id);
          if (data.uid) {
            userIdsByCanonicalKey.get(canonicalKey)?.add(data.uid);
          }

          const current = usersByCanonicalKey.get(canonicalKey);
          const currentUpdatedAt = current?.updated_at
            ? new Date(current.updated_at).getTime()
            : 0;
          const nextUpdatedAt = data?.updated_at
            ? new Date(data.updated_at).getTime()
            : 0;

          if (!current || nextUpdatedAt >= currentUpdatedAt) {
            usersByCanonicalKey.set(canonicalKey, data);
          }
        });

        const candidaturasPorCanonicalKey = new Map<string, any[]>();
        candidaturasData.forEach((c: any) => {
          if (!c?.candidato_id) return;
          const canonicalKey = canonicalKeyByUserId.get(c.candidato_id);
          if (!canonicalKey) return;

          if (!candidaturasPorCanonicalKey.has(canonicalKey)) {
            candidaturasPorCanonicalKey.set(canonicalKey, []);
          }
          candidaturasPorCanonicalKey.get(canonicalKey)?.push(c);
        });

        const convitesPorCanonicalKey = new Map<string, any[]>();
        convitesPorCandidato.forEach((convites: any[], candidateId: string) => {
          const canonicalKey = canonicalKeyByUserId.get(candidateId);
          if (!canonicalKey) return;

          if (!convitesPorCanonicalKey.has(canonicalKey)) {
            convitesPorCanonicalKey.set(canonicalKey, []);
          }
          convitesPorCanonicalKey.get(canonicalKey)?.push(...convites);
        });

        const talentosData = Array.from(usersByCanonicalKey.entries()).map(
          ([canonicalKey, data]: [string, any]) => {
            const convites = convitesPorCanonicalKey.get(canonicalKey) || [];
            const candidaturasDoCandidato =
              candidaturasPorCanonicalKey.get(canonicalKey) || [];
            const resume = getResumeData(data);
            const foiConvidado = convites.length > 0 ? "Sim" : "Não";
            const vagasConvidadas = Array.from(
              new Set(convites.map((c: any) => c.vagaTitulo).filter(Boolean)),
            ).join(", ");
            const datasConvites = Array.from(
              new Set(
                convites.map((c: any) =>
                  c.dataConvite.toLocaleDateString("pt-BR"),
                ),
              ),
            ).join(", ");
            const vagasCandidatadas = Array.from(
              new Set(
                candidaturasDoCandidato
                  .map((c: any) => vagasPorId.get(c.vaga_id)?.titulo)
                  .filter(Boolean),
              ),
            ).join(", ");
            const jaSeCandidatou = vagasCandidatadas ? "Sim" : "Não";

            return {
              id: data.id,
              idsRelacionados: Array.from(
                userIdsByCanonicalKey.get(canonicalKey) || [],
              ),
              ...data,
              dataCadastro: data.created_at || "",
              nome: data.nome || resume.nome || "Sem Nome",
              email: data.email || resume.email || "Não informado",
              formacao: resume.formacao || resume.formacoes?.[0]?.curso || "",
              areaInteresse:
                resume.areaInteresse || resume.area_interesse || "",
              experiencia: Array.isArray(resume.experiencias)
                ? resume.experiencias.length
                : 0,
              resumeData: data.resume_data || data.resumeData || {},
              foiConvidado,
              vagasConvidadas,
              datasConvites,
              jaSeCandidatou,
              vagasCandidatadas,
              status:
                candidaturasDoCandidato.length > 0
                  ? "Em processo"
                  : "Disponível",
            } as any;
          },
        );

        setTalentos(talentosData);
      } catch (error) {
        console.error("Erro ao buscar talentos:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleConvidar = async () => {
    if (!selectedTalentoId || !selectedVagaToConvidar) return;
    try {
      const talento = talentos.find((t) => t.id === selectedTalentoId);
      const vaga = vagasAbertas.find((v) => v.id === selectedVagaToConvidar);

      // Em vez de criar uma candidatura (associação direta), apenas registramos o convite no log
      // e enviamos o e-mail. O candidato deverá se candidatar por conta própria.
      try {
        await logAudit(
          "Enviou Convite",
          "Banco de Talentos",
          JSON.stringify({
            candidato_id: selectedTalentoId,
            vaga_id: selectedVagaToConvidar,
            vaga_titulo: vaga?.cargo,
          }),
        );
      } catch (logError) {
        console.warn("Erro ao registrar log de convite:", logError);
      }

      // O envio agora é centralizado em /api/send-email.
      // A rota protegida grava a fila com service_role e aplica autenticação,
      // rate limit e idempotência. Não gravamos SMTP credentials no cliente.
      
      const currentTalentoId = selectedTalentoId;

      alert(
        `Convite enviado com sucesso para ${talento?.nome}! O candidato agora deve se candidatar à vaga.`,
      );
      setIsConvidarModalOpen(false);
      setSelectedTalentoId(null);
      setSelectedVagaToConvidar(null);

      // Update local state directly for immediate feedback
      setTalentos((prev) =>
        prev.map((t) => {
          if (t.id === currentTalentoId) {
            const newVagasConvidadas =
              t.vagasConvidadas && t.vagasConvidadas !== "-"
                ? `${t.vagasConvidadas}, ${vaga?.cargo}`
                : vaga?.cargo;
            const newDatasConvites =
              t.datasConvites && t.datasConvites !== "-"
                ? `${t.datasConvites}, ${new Date().toLocaleDateString("pt-BR")}`
                : new Date().toLocaleDateString("pt-BR");

            return {
              ...t,
              foiConvidado: "Sim",
              vagasConvidadas: newVagasConvidadas,
              datasConvites: newDatasConvites,
            };
          }
          return t;
        }),
      );
    } catch (error) {
      console.error("Erro ao enviar convite:", error);
      alert("Erro ao enviar convite.");
    }
  };

  const formatDateTime = (isoString: string) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const handleSort = (key: string) => {
    let direction: "asc" | "desc" = "asc";
    if (
      sortConfig &&
      sortConfig.key === key &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }
    setSortConfig({ key, direction });
  };

  const handleColumnFilterChange = (key: string, value: string) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
  };

  const filteredTalentos = talentos
    .filter((talento) => {
      const matchesSearch =
        talento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
        talento.formacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
        talento.areaInteresse.toLowerCase().includes(searchTerm.toLowerCase());

      if (!matchesSearch) return false;

      for (const [key, value] of Object.entries(columnFilters)) {
        if (!value) continue;

        let itemValue = String(
          talento[key as keyof typeof talento] || "",
        ).toLowerCase();
        if (key === "dataCadastro") {
          itemValue = formatDateTime(talento.dataCadastro).toLowerCase();
        }

        if (!itemValue.includes(String(value).toLowerCase())) {
          return false;
        }
      }
      return true;
    })
    .sort((a, b) => {
      if (!sortConfig) return 0;
      const { key, direction } = sortConfig;

      let aValue: any = a[key as keyof typeof a];
      let bValue: any = b[key as keyof typeof b];

      if (key === "dataCadastro") {
        aValue = new Date(a.dataCadastro).getTime();
        bValue = new Date(b.dataCadastro).getTime();
      } else if (key === "experiencia") {
        aValue = Number(aValue);
        bValue = Number(bValue);
      } else {
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
      }

      if (aValue < bValue) return direction === "asc" ? -1 : 1;
      if (aValue > bValue) return direction === "asc" ? 1 : -1;
      return 0;
    });

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3 h-3 text-primary" />
    ) : (
      <ArrowDown className="w-3 h-3 text-primary" />
    );
  };

  const renderFilterInput = (key: string, label: string) => {
    return (
      <div className="flex flex-col gap-1">
        <div
          className="flex items-center justify-between cursor-pointer group"
          onClick={() => handleSort(key)}
        >
          <span>{label}</span>
          <div className="flex items-center gap-1">
            {renderSortIcon(key)}
            <button
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterColumn(activeFilterColumn === key ? null : key);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? "text-primary" : "text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity"}`}
              title="Filtrar coluna"
            >
              <Filter className="w-3 h-3" />
            </button>
          </div>
        </div>
        {activeFilterColumn === key && (
          <input
            type="text"
            placeholder={`Filtrar...`}
            value={columnFilters[key] || ""}
            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-2 py-1 text-xs font-normal border border-slate-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          />
        )}
      </div>
    );
  };

  const handleOpenConvidarModal = (id: string) => {
    setSelectedTalentoId(id);
    setIsConvidarModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Banco de Talentos</h2>
        <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 w-full max-w-md">
          <Search className="w-5 h-5 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Buscar por nome, formação ou área..."
            className="w-full px-2 py-1 focus:outline-none"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 min-w-[150px]">
                  {renderFilterInput("nome", "Nome")}
                </th>
                <th className="px-6 py-4 min-w-[150px]">
                  {renderFilterInput("email", "E-mail")}
                </th>
                <th className="px-6 py-4 min-w-[120px]">
                  {renderFilterInput("formacao", "Formação")}
                </th>
                <th className="px-6 py-4 min-w-[120px]">
                  {renderFilterInput("areaInteresse", "Área")}
                </th>
                <th className="px-6 py-4 min-w-[80px]">
                  {renderFilterInput("experiencia", "Exp.")}
                </th>
                <th className="px-6 py-4 min-w-[100px]">
                  {renderFilterInput("foiConvidado", "Convidado")}
                </th>
                <th className="px-6 py-4 min-w-[150px]">
                  {renderFilterInput("vagasConvidadas", "Vaga(s)")}
                </th>
                <th className="px-6 py-4 min-w-[120px]">
                  {renderFilterInput("datasConvites", "Data Convite")}
                </th>
                <th className="px-6 py-4 min-w-[100px]">
                  {renderFilterInput("jaSeCandidatou", "Já se candidatou")}
                </th>
                <th className="px-6 py-4 min-w-[180px]">
                  {renderFilterInput("vagasCandidatadas", "Vaga(s) candidatas")}
                </th>
                <th className="px-6 py-4 min-w-[100px]">
                  {renderFilterInput("status", "Status")}
                </th>
                <th className="px-6 py-4 text-right min-w-[100px]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTalentos.map((talento) => (
                <tr
                  key={talento.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-primary transition-colors">
                    {talento.nome}
                  </td>
                  <td className="px-6 py-4">{talento.email}</td>
                  <td className="px-6 py-4">{talento.formacao}</td>
                  <td className="px-6 py-4">
                    {talento.areaInteresse || "Geral"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    {talento.experiencia || 0}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${talento.foiConvidado === "Sim" ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {talento.foiConvidado}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {talento.vagasConvidadas || "-"}
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {talento.datasConvites || "-"}
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${talento.jaSeCandidatou === "Sim" ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}`}
                    >
                      {talento.jaSeCandidatou}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    {talento.vagasCandidatadas || "-"}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        talento.status === "Disponível"
                          ? "bg-emerald-100 text-emerald-700"
                          : talento.status === "Em processo"
                            ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"
                      }`}
                    >
                      {talento.status || "Disponível"}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCandidato(talento);
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Ver Perfil"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenConvidarModal(talento.id);
                        }}
                        className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                        title="Convidar Talento"
                      >
                        <UserPlus className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTalentos.length === 0 && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhum talento encontrado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Convidar para Vaga */}
      {isConvidarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">
              Convidar para uma Vaga
            </h3>
            <p className="text-slate-600 mb-4 text-sm">
              Selecione a vaga para a qual deseja convidar o candidato. Um
              e-mail será enviado com o convite para que ele se candidate.
            </p>

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Vaga
                </label>
                <select
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  value={selectedVagaToConvidar || ""}
                  onChange={(e) => setSelectedVagaToConvidar(e.target.value)}
                >
                  <option value="" disabled>
                    Selecione uma vaga...
                  </option>
                  {vagasAbertas
                    .filter(
                      (vaga) =>
                        profile?.perfil === "Admin" ||
                        vaga.ownerId === profile?.uid,
                    )
                    .map((vaga) => (
                      <option key={vaga.id} value={vaga.id}>
                        {vaga.cargo}
                      </option>
                    ))}
                </select>
                {vagasAbertas.filter(
                  (vaga) =>
                    profile?.perfil === "Admin" ||
                    vaga.ownerId === profile?.uid,
                ).length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1 italic">
                    Você não possui vagas abertas sob sua responsabilidade.
                  </p>
                )}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setIsConvidarModalOpen(false);
                  setSelectedVagaToConvidar(null);
                }}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleConvidar}
                disabled={!selectedVagaToConvidar}
                className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Enviar Convite
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCandidato && (
        <CandidateProfileModal
          candidato={selectedCandidato}
          onClose={() => setSelectedCandidato(null)}
        />
      )}
    </div>
  );
}

export function HRProvas() {
  const [provas, setProvas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isVersionsModalOpen, setIsVersionsModalOpen] = useState(false);
  const [editingProva, setEditingProva] = useState<any>(null);
  const [selectedProvaForVersions, setSelectedProvaForVersions] =
    useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const { profile } = useAuth();

  // Form state
  const [formData, setFormData] = useState({
    nome: "",
    tipo: "link", // 'arquivo' ou 'link'
    link: "",
  });
  const [vagas, setVagas] = useState<any[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [provaPendenteExclusao, setProvaPendenteExclusao] = useState<any>(null);

  const fetchVagas = async () => {
    const { data } = await supabase
      .from("vagas")
      .select("id, titulo")
      .eq("status", "Aberta");
    setVagas(data || []);
  };

  const fetchProvas = async () => {
    try {
      setLoading(true);
      // Fetch all versions and we'll group them in JS
      const { data, error } = await supabase
        .from("provas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Group by grupo_id and keep only the latest version for the main list
      const latestVersions: any[] = [];
      const groupsSeen = new Set();

      (data || []).forEach((p) => {
        if (p.grupo_id && !groupsSeen.has(p.grupo_id)) {
          latestVersions.push(p);
          groupsSeen.add(p.grupo_id);
        } else if (
          !p.grupo_id &&
          !latestVersions.find((lv) => lv.nome === p.nome)
        ) {
          // Fallback for old data without grupo_id
          latestVersions.push(p);
        }
      });

      setProvas(latestVersions);
    } catch (error) {
      console.error("Erro ao buscar provas:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProvas();
    fetchVagas();
  }, []);

  const handleOpenModal = (prova?: any) => {
    if (prova) {
      setEditingProva(prova);
      setFormData({
        nome: prova.nome || "",
        tipo: prova.tipo || "link",
        link: prova.link || "",
      });
    } else {
      setEditingProva(null);
      setFormData({
        nome: "",
        tipo: "link",
        link: "",
      });
    }
    setFile(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nome.trim()) {
      alert("O nome da prova é obrigatório.");
      return;
    }

    setIsProcessing(true);
    try {
      let finalLink = formData.link;

      if (formData.tipo === "arquivo" && file) {
        const uploadedFiles = await uploadFiles([file], "provas");
        if (uploadedFiles && uploadedFiles.length > 0) {
          finalLink = uploadedFiles[0].url;
        }
      }

      if (editingProva) {
        const { error } = await supabase
          .from("provas")
          .update({
            nome: formData.nome,
            tipo: formData.tipo,
            link: finalLink,
          })
          .eq("id", editingProva.id);

        if (error) throw error;

        await logAudit(
          "Editar Prova",
          "Gestão de Provas",
          `Editou a prova: ${formData.nome}`,
        );
      } else {
        const payload = {
          nome: formData.nome,
          tipo: formData.tipo,
          link: finalLink,
        };

        const { error } = await supabase.from("provas").insert([payload]);
        if (error) throw error;

        await logAudit(
          "Salvar Prova",
          "Gestão de Provas",
          `Criou a prova: ${formData.nome}`,
        );
      }

      setIsModalOpen(false);
      fetchProvas();
    } catch (error: any) {
      console.error("Erro ao salvar prova:", error);
      alert("Erro ao salvar prova: " + error.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProva = async (prova: any) => {
    if (!provaPendenteExclusao || provaPendenteExclusao.id !== prova.id) {
      setProvaPendenteExclusao(prova);
      return;
    }

    try {
      let query = supabase.from("provas").delete();

      if (prova.grupo_id) {
        query = query.eq("grupo_id", prova.grupo_id);
      } else {
        query = query.eq("nome", prova.nome);
      }

      const { error } = await query;

      if (error) throw error;
      await logAudit(
        "Excluir Prova",
        "Gestão de Provas",
        `Excluiu a prova ${prova.nome} e todas as suas versões.`,
      );
      setProvaPendenteExclusao(null);
      fetchProvas();
    } catch (error: any) {
      console.error("Erro ao excluir prova:", error);
      alert("Erro ao excluir prova: " + error.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Banco de Provas</h2>
        <button
          onClick={() => handleOpenModal()}
          className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nova Prova
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Tipo</th>
                <th className="px-6 py-4 text-center">Versão Atual</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Carregando provas...
                  </td>
                </tr>
              ) : provas.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhuma prova cadastrada.
                  </td>
                </tr>
              ) : (
                provas.map((prova) => (
                  <tr
                    key={prova.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-medium text-slate-900">
                        {prova.nome}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          prova.tipo === "arquivo"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {prova.tipo}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold inline-flex justify-center min-w-[40px]">
                        V{prova.versao || 1}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenModal(prova)}
                          className="p-2 text-slate-400 hover:text-primary transition-colors"
                          title="Editar Prova"
                        >
                          <Save className="w-5 h-5" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedProvaForVersions(prova);
                            setIsVersionsModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-indigo-500 transition-colors"
                          title="Histórico de Versões"
                        >
                          <Layers className="w-5 h-5" />
                        </button>
                        <a
                          href={prova.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                          title={
                            prova.tipo === "link"
                              ? "Ver Link"
                              : "Baixar Arquivo"
                          }
                        >
                          {prova.tipo === "link" ? (
                            <ExternalLink className="w-5 h-5" />
                          ) : (
                            <Download className="w-5 h-5" />
                          )}
                        </a>
                        {provaPendenteExclusao?.id === prova.id ? (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleDeleteProva(prova)}
                              className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                              title="Confirmar exclusão"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setProvaPendenteExclusao(null)}
                              className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                              title="Cancelar exclusão"
                            >
                              Cancelar
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleDeleteProva(prova)}
                            className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                            title="Excluir Prova"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                {editingProva ? "Editar Prova" : "Nova Prova"}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Nome da Prova <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.nome || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  placeholder="Ex: Teste de Lógica Nível I"
                />
              </div>

              {!editingProva && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Tipo de Entrega
                    </label>
                    <select
                      value={formData.tipo || "link"}
                      onChange={(e) =>
                        setFormData({ ...formData, tipo: e.target.value })
                      }
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      <option value="link">Link Externo</option>
                      <option value="arquivo">Upload de Arquivo</option>
                    </select>
                  </div>

                  {formData.tipo === "link" ? (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Link da Prova
                      </label>
                      <input
                        type="url"
                        value={formData.link || ""}
                        onChange={(e) =>
                          setFormData({ ...formData, link: e.target.value })
                        }
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                        placeholder="https://..."
                      />
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">
                        Arquivo da Prova
                      </label>
                      <input
                        type="file"
                        onChange={(e) => setFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}
                </>
              )}

              <div className="pt-6 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing}
                  className="px-6 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-accent transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      {editingProva ? "Salvar Alterações" : "Criar Prova"}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isVersionsModalOpen && selectedProvaForVersions && (
        <VersionsModal
          prova={selectedProvaForVersions}
          onClose={() => {
            setIsVersionsModalOpen(false);
            setSelectedProvaForVersions(null);
          }}
        />
      )}
    </div>
  );
}

function VersionsModal({
  prova,
  onClose,
}: {
  prova: any;
  onClose: () => void;
}) {
  const [versoes, setVersoes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVersoes = async () => {
    try {
      setLoading(true);
      let query = supabase.from("provas").select("*");

      if (prova.grupo_id) {
        query = query.eq("grupo_id", prova.grupo_id);
      } else {
        query = query.eq("nome", prova.nome);
      }

      const { data, error } = await query.order("versao", { ascending: false });

      if (error) throw error;
      setVersoes(data || []);
    } catch (error) {
      console.error("Erro ao buscar versões:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVersoes();
  }, [prova.grupo_id, prova.nome]);

  const [versaoPendenteExclusao, setVersaoPendenteExclusao] = useState<
    string | null
  >(null);

  const deleteVersao = async (id: string, versao: number) => {
    if (versaoPendenteExclusao !== id) {
      setVersaoPendenteExclusao(id);
      return;
    }

    try {
      const { error } = await supabase.from("provas").delete().eq("id", id);

      if (error) throw error;
      await logAudit(
        "Excluir Versão Prova",
        "Gestão de Provas",
        `Excluiu versão ${versao} da prova: ${prova.nome}`,
      );
      setVersaoPendenteExclusao(null);
      fetchVersoes();
    } catch (error: any) {
      console.error("Erro ao excluir versão:", error);
      alert("Erro ao excluir versão: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <h3 className="text-lg font-bold text-slate-900">
            Histórico de Versões: {prova.nome}
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-8 text-slate-500">
                Carregando histórico...
              </div>
            ) : versoes.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Nenhuma versão encontrada.
              </div>
            ) : (
              versoes.map((v) => (
                <div
                  key={v.id}
                  className="bg-slate-50 rounded-lg p-4 border border-slate-200 flex items-center justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-slate-900">
                        Versão {v.versao}
                      </span>
                      <span className="text-xs text-slate-500">
                        {new Date(v.created_at).toLocaleDateString()}{" "}
                        {new Date(v.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div className="text-sm text-slate-600">
                      Tipo: <span className="capitalize">{v.tipo}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <a
                      href={v.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:text-blue-500 transition-colors"
                      title={v.tipo === "link" ? "Ver Link" : "Baixar Arquivo"}
                    >
                      {v.tipo === "link" ? (
                        <ExternalLink className="w-4 h-4" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                    </a>
                    {versaoPendenteExclusao === v.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => deleteVersao(v.id, v.versao)}
                          className="px-2 py-1 text-xs bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
                          title="Confirmar exclusão"
                        >
                          Confirmar
                        </button>
                        <button
                          onClick={() => setVersaoPendenteExclusao(null)}
                          className="px-2 py-1 text-xs bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors"
                          title="Cancelar exclusão"
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => deleteVersao(v.id, v.versao)}
                        className="p-2 bg-white border border-slate-200 rounded-lg text-slate-400 hover:text-red-500 transition-colors"
                        title="Excluir Versão"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 text-sm font-medium bg-white border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}

export function HRProfile() {
  const { profile, refreshProfile, updateProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    cargo: "",
    matricula: "",
    unidade_negocio_id: "",
    foto_url: "",
  });
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Buscar unidades de negócio ativas
        const { data: unidadesData } = await supabase
          .from("unidades_negocio")
          .select("id, nome")
          .eq("ativo", true)
          .order("nome");

        setUnidades(unidadesData || []);

        if (profile) {
          setFormData({
            nome: profile.nome || "",
            email: profile.email || "",
            cargo: profile.cargo || "",
            matricula: profile.matricula || "",
            unidade_negocio_id: profile.unidade_negocio_id || "",
            foto_url: profile.avatar_url || (profile as any).foto_url || "",
          });
        }
      } catch (error) {
        console.error("Erro ao buscar dados do perfil:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [profile]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("A imagem deve ter no máximo 2MB.");
      return;
    }

    setUploading(true);
    try {
      // Sincronização obrigatória de sessão
      await supabase.auth.refreshSession();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // Fallback para o ID do perfil caso a sessão do Supabase ainda esteja nula
      // Isso evita o erro impeditivo, embora o upload possa falhar na RLS se o JWT não for enviado
      const activeUserId = session?.user?.id || profile?.id || profile?.uid;

      if (!activeUserId) {
        throw new Error("Sessão não encontrada no momento do upload");
      }

      const activeUser = session?.user || { id: activeUserId };

      const fileExt = file.name.split(".").pop();
      const fileName = `${activeUserId}_${Date.now()}.${fileExt}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(fileName, file, { upsert: true });

      console.log("UPLOAD_RESULT (HR):", {
        data: uploadData,
        error: uploadError,
      });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("avatars").getPublicUrl(fileName);

      const urlComCacheBuster = publicUrl + "?t=" + new Date().getTime();

      setFormData((prev) => ({ ...prev, foto_url: urlComCacheBuster }));

      // Salvar imediatamente no banco para persistir
      await supabase
        .from("users")
        .update({ avatar_url: urlComCacheBuster, foto_url: urlComCacheBuster })
        .eq("id", activeUserId);

      // Injeta a URL pública direto no contexto garantindo a sincronização em tempo real
      if (updateProfile) {
        updateProfile({
          avatar_url: urlComCacheBuster,
          foto_url: urlComCacheBuster,
        });
      }
    } catch (error: any) {
      console.error("Erro no upload:", error);
      alert("Erro ao fazer upload da imagem: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (profile?.perfil !== "RH" && profile?.perfil !== "Admin") {
      alert("Apenas usuários do tipo RH ou Admin podem editar este perfil.");
      return;
    }

    setSaving(true);
    try {
      // Tenta sincronizar a sessão antes de salvar
      await supabase.auth.refreshSession();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const userId = session?.user?.id || profile?.id || profile?.uid;

      if (!userId) throw new Error("Usuário não autenticado");

      const { error } = await supabase
        .from("users")
        .update({
          nome: formData.nome,
          cargo: formData.cargo,
          matricula: formData.matricula,
          unidade_negocio_id: formData.unidade_negocio_id || null,
          avatar_url: formData.foto_url,
          foto_url: formData.foto_url, // fallback legacy support
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      if (updateProfile) {
        updateProfile({
          avatar_url: formData.foto_url, // Força o refresh pela chave principal do authcontext
          foto_url: formData.foto_url,
          nome: formData.nome,
          cargo: formData.cargo,
          matricula: formData.matricula,
          unidade_negocio_id: formData.unidade_negocio_id,
        });
      }

      await logAudit(
        "Atualizar Perfil",
        "RH",
        "Usuário atualizou seus dados de perfil.",
      );
      alert("Perfil atualizado com sucesso!");
    } catch (error: any) {
      console.error("Erro ao salvar perfil:", error);
      alert("Erro ao salvar perfil: " + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        Carregando perfil...
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">
          Meu Perfil Profissional
        </h1>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <form onSubmit={handleSubmit} className="divide-y divide-slate-200">
          {/* Cabeçalho do Perfil / Foto */}
          <div className="p-8 flex flex-col md:flex-row items-center gap-8 bg-slate-50/50">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full bg-primary/10 border-4 border-white shadow-md overflow-hidden flex items-center justify-center text-primary text-4xl font-bold">
                {formData.foto_url ? (
                  <img
                    src={formData.foto_url}
                    alt="Foto de Perfil"
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  formData.nome.charAt(0)
                )}
              </div>
              <label className="absolute inset-0 flex items-center justify-center bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <div className="flex flex-col items-center">
                  <ImageIcon className="w-6 h-6 mb-1" />
                  <span className="text-[10px] font-medium">Alterar</span>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
              </label>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/60 rounded-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                </div>
              )}
            </div>

            <div className="flex-1 text-center md:text-left">
              <h2 className="text-xl font-bold text-slate-900">
                {formData.nome || "Seu Nome"}
              </h2>
              <p className="text-slate-500">{formData.email}</p>
              <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                Perfil RH
              </div>
            </div>
          </div>

          {/* Campos do Formulário */}
          <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={formData.nome}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, nome: e.target.value }))
                }
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cargo
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Briefcase className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Ex: Analista de RH Senior"
                  value={formData.cargo}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, cargo: e.target.value }))
                  }
                  className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Matrícula
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FileText className="h-4 w-4 text-slate-400" />
                </div>
                <input
                  type="text"
                  placeholder="Ex: 123456"
                  value={formData.matricula}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      matricula: e.target.value,
                    }))
                  }
                  className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Unidade de Negócio
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <MapPin className="h-4 w-4 text-slate-400" />
                </div>
                <select
                  value={formData.unidade_negocio_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      unidade_negocio_id: e.target.value,
                    }))
                  }
                  className="pl-10 w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none bg-white"
                >
                  <option value="">Selecione uma unidade...</option>
                  {unidades.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="p-8 bg-slate-50 flex justify-end">
            <button
              type="submit"
              disabled={saving || uploading}
              className="flex items-center gap-2 bg-primary text-white px-8 py-2.5 rounded-lg font-bold hover:bg-accent transition-all shadow-md hover:shadow-lg disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {saving ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
