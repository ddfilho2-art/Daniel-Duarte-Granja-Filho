import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  Target,
  Clock,
  Users,
  FileCheck,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
  Download,
  Filter,
  ChevronRight,
  Calendar,
  Building2,
  Briefcase,
  Award,
  MessageSquare,
  Activity,
  Zap,
  Info,
  User,
  Mail,
  Phone,
} from "lucide-react";
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
  AreaChart,
  Area,
  FunnelChart,
  Funnel,
  LabelList,
} from "recharts";
import { supabase } from "../lib/supabase";
import { useAuth } from "../contexts/AuthContext";
import { logAudit } from "../lib/audit";

const COLORS = [
  "#6366f1",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

interface ReportData {
  vaga: any;
  summary: {
    titulo: string;
    codigoVaga: string | null;
    departamento: string | null;
    empresa: string | null;
    ownerNome: string | null;
    statusFinal: string | null;
    dataAbertura: string | null;
    dataEncerramento: string | null;
    duracaoDias: number;
    quantidadeVagas: number;
    quantidadeContratada: number;
  };
  resultadoFinal: {
    houveContratacao: boolean;
    totalContratados: number;
    contratados: Array<{
      candidaturaId: string;
      candidatoId: string;
      nome: string;
      email: string;
      telefone: string | null;
      fase: string | null;
      status: string | null;
      dataContratacao: string | null;
    }>;
  };
  stats: {
    totalCandidatos: number;
    statusCounts: { [key: string]: number };
    faseCounts: { [key: string]: number };
    tempoMedioProcesso: number;
    tempoMedioPorEtapa: { name: string; dias: number }[];
    taxaConversaoFinal: number;
    funilData: { name: string; value: number }[];
  };
  provas: {
    exigeProva: boolean;
    nome: string | null;
    versao: string | null;
    totalParticipantes: number;
    aprovados: number;
    reprovados: number;
    pendentes: number;
    mediaNotas: number | null;
  } | null;
  analise: {
    pontosFortes: string[];
    gargalos: string[];
    sugestoes: string[];
  };
}

export function HRRelatorios() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [vagas, setVagas] = useState<any[]>([]);
  const [selectedVagaId, setSelectedVagaId] = useState("");
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchVagas = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from("vagas")
          .select("*, candidaturas(count)");

        if (error) throw error;
        setVagas(data || []);
      } catch (err) {
        console.error("Erro ao buscar vagas para relatório:", err);
        setError("Erro ao carregar vagas para relatório.");
      } finally {
        setLoading(false);
      }
    };

    fetchVagas();
  }, []);

  const generateReport = async () => {
    if (!selectedVagaId) return;

    const selectedVaga = vagas.find((v) => v.id === selectedVagaId);
    const isEncerrada =
      selectedVaga?.status?.toUpperCase() === "ENCERRADA" ||
      (selectedVaga?.quantidade_contratada || 0) >= 1;

    if (!isEncerrada) {
      setError("Relatório disponível apenas para vagas encerradas");
      return;
    }

    setGenerating(true);
    setError("");
    setReportData(null);

    try {
      const { data: vaga, error: vagaError } = await supabase
        .from("vagas")
        .select("*, provas(*)")
        .eq("id", selectedVagaId)
        .maybeSingle();

      if (vagaError) throw vagaError;

      const { data: candidaturas, error: candError } = await supabase
        .from("candidaturas")
        .select("*")
        .eq("vaga_id", selectedVagaId);

      if (candError) throw candError;

      if (!candidaturas || candidaturas.length === 0) {
        setError("Nenhuma candidatura encontrada para esta vaga.");
        setGenerating(false);
        return;
      }

      const candidatoIds = candidaturas
        .map((c) => c.candidato_id)
        .filter(Boolean);
      const { data: candidatosUsers, error: candidatosUsersError } =
        await supabase
          .from("users")
          .select("id, uid, nome, email, telefone, resume_data")
          .in("id", candidatoIds);

      if (candidatosUsersError) throw candidatosUsersError;

      const candidatosMap = new Map(
        (candidatosUsers || []).map((u: any) => [u.id, u]),
      );

      const { data: eventos, error: eventosError } = await supabase
        .from("candidatura_eventos")
        .select("*")
        .in(
          "candidatura_id",
          candidaturas.map((c) => c.id),
        )
        .order("created_at", { ascending: true });

      if (eventosError) throw eventosError;

      const statusCounts: { [key: string]: number } = {};
      const faseCounts: { [key: string]: number } = {};
      let totalNotas = 0;
      let totalComTeste = 0;
      let aprovadosTeste = 0;
      let totalContratados = 0;

      const isContratadoFinal = (c: any) => {
        const status = (c.status || "").toUpperCase();
        const fase = (c.fase || "").trim().toLowerCase();
        return (
          fase === "contratado" ||
          fase === "contrato" ||
          status === "CONTRATADO" ||
          status === "APROVADA"
        );
      };

      candidaturas.forEach((c) => {
        const status = (c.status || "EM_PROCESSO").toUpperCase();
        statusCounts[status] = (statusCounts[status] || 0) + 1;

        const fase = c.fase ?? "Triagem";
        faseCounts[fase] = (faseCounts[fase] || 0) + 1;

        if (
          c.nota_teste !== null &&
          c.nota_teste !== undefined &&
          c.nota_teste !== ""
        ) {
          totalNotas += Number(c.nota_teste);
          totalComTeste++;
        }

        if (String(c.aprovacao_teste || "").toLowerCase() === "aprovado") {
          aprovadosTeste++;
        }

        if (isContratadoFinal(c)) {
          totalContratados++;
        }
      });

      const stages = [
        "Triagem",
        "Entrevista RH",
        "Prova",
        "Entrevista Gestor",
        "Proposta",
        "Entrega de documentação",
        "Exame Médico",
        "Contrato",
      ];

      const funilData = stages.map((stage, index) => {
        const count = candidaturas.filter((c) => {
          const currentStage = c.fase ?? "Triagem";
          const stageIndex = stages.indexOf(currentStage);
          return stageIndex >= index || currentStage === "Contratado";
        }).length;
        return { name: stage, value: count };
      });

      const tempoEtapas: { [key: string]: number[] } = {};
      (candidaturas || []).forEach((cand) => {
        const candEvents = (eventos || []).filter(
          (e: any) => e.candidatura_id === cand.id,
        );
        if (candEvents.length > 1) {
          for (let i = 0; i < candEvents.length - 1; i++) {
            const inicio = new Date(candEvents[i].created_at).getTime();
            const fim = new Date(candEvents[i + 1].created_at).getTime();
            const dias = (fim - inicio) / (1000 * 60 * 60 * 24);
            const fase =
              candEvents[i].tipo === "FASE"
                ? candEvents[i].descricao.match(/fase: (.*?)(?: \(|$)/)?.[1] ||
                  "Triagem"
                : candEvents[i].tipo;
            if (!tempoEtapas[fase]) tempoEtapas[fase] = [];
            tempoEtapas[fase].push(dias);
          }
        }
      });

      const tempoMedioPorEtapa = Object.entries(tempoEtapas).map(
        ([name, dias]) => ({
          name,
          dias: Math.round(dias.reduce((acc, d) => acc + d, 0) / dias.length),
        }),
      );

      const dataAberturaRaw = vaga.created_at || vaga.criado_em || null;
      const dataEncerramentoRaw = vaga.encerrada_em || vaga.updated_at || null;
      const duracaoDias =
        dataAberturaRaw && dataEncerramentoRaw
          ? Math.max(
              0,
              Math.round(
                (new Date(dataEncerramentoRaw).getTime() -
                  new Date(dataAberturaRaw).getTime()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : 0;

      const summary = {
        titulo: vaga.titulo || "Sem título",
        codigoVaga: vaga.codigo_vaga || null,
        departamento: vaga.departamento || null,
        empresa: vaga.empresa || null,
        ownerNome: vaga.owner_nome || null,
        statusFinal: vaga.status || vaga.status_vaga || null,
        dataAbertura: dataAberturaRaw,
        dataEncerramento: dataEncerramentoRaw,
        duracaoDias,
        quantidadeVagas: Number(vaga.quantidade_vagas || 0),
        quantidadeContratada: Number(
          vaga.quantidade_contratada || totalContratados || 0,
        ),
      };

      const contratados = candidaturas
        .filter((c) => isContratadoFinal(c))
        .map((c) => {
          const candidato = candidatosMap.get(c.candidato_id);
          return {
            candidaturaId: c.id,
            candidatoId: c.candidato_id,
            nome: candidato?.nome || "Não identificado",
            email: candidato?.email || "Não informado",
            telefone:
              candidato?.telefone || candidato?.resume_data?.telefone || null,
            fase: c.fase || null,
            status: c.status || null,
            dataContratacao: c.updated_at || c.data_contratacao || null,
          };
        });

      const resultadoFinal = {
        houveContratacao: contratados.length > 0,
        totalContratados: contratados.length,
        contratados,
      };

      const provas =
        vaga?.exige_prova === true || vaga?.exige_prova === "Sim"
          ? {
              exigeProva: true,
              nome:
                vaga?.provas?.nome ||
                vaga?.provas?.[0]?.nome ||
                "Prova Técnica",
              versao: vaga?.provas?.versao || vaga?.provas?.[0]?.versao || null,
              totalParticipantes: totalComTeste,
              aprovados: aprovadosTeste,
              reprovados: candidaturas.filter(
                (c) =>
                  String(c.aprovacao_teste || "").toLowerCase() === "reprovado",
              ).length,
              pendentes: candidaturas.filter((c) => {
                const fase = (c.fase || "").toLowerCase();
                const aprovacao = String(c.aprovacao_teste || "").toLowerCase();
                return fase.includes("prova") && !aprovacao;
              }).length,
              mediaNotas:
                totalComTeste > 0
                  ? Math.round((totalNotas / totalComTeste) * 10) / 10
                  : null,
            }
          : {
              exigeProva: false,
              nome: null,
              versao: null,
              totalParticipantes: 0,
              aprovados: 0,
              reprovados: 0,
              pendentes: 0,
              mediaNotas: null,
            };

      const taxaConversaoFinal =
        candidaturas.length > 0
          ? Math.round((totalContratados / candidaturas.length) * 100)
          : 0;
      const tempoMedioProcesso =
        tempoMedioPorEtapa.length > 0
          ? Math.round(
              tempoMedioPorEtapa.reduce((acc, item) => acc + item.dias, 0) /
                tempoMedioPorEtapa.length,
            )
          : duracaoDias;

      const pontosFortes: string[] = [];
      const gargalos: string[] = [];
      const sugestoes: string[] = [];

      if (taxaConversaoFinal >= 20)
        pontosFortes.push("Boa taxa de conversão final para a vaga.");
      if (provas.exigeProva && provas.aprovados > 0)
        pontosFortes.push("Houve aprovação de candidatos na etapa de prova.");
      if (tempoMedioProcesso > 30)
        gargalos.push("Tempo médio total do processo acima do esperado.");
      if (provas.exigeProva && provas.reprovados > provas.aprovados)
        gargalos.push("Alta taxa de reprovação na prova.");
      if (tempoMedioProcesso > 30)
        sugestoes.push(
          "Revisar tempos entre etapas para reduzir o tempo total da seleção.",
        );
      if (provas.exigeProva && provas.pendentes > 0)
        sugestoes.push("Acompanhar candidatos pendentes na etapa de prova.");

      setReportData({
        vaga,
        summary,
        resultadoFinal,
        stats: {
          totalCandidatos: candidaturas.length,
          statusCounts,
          faseCounts,
          tempoMedioProcesso,
          tempoMedioPorEtapa,
          taxaConversaoFinal,
          funilData,
        },
        provas,
        analise: {
          pontosFortes:
            pontosFortes.length > 0
              ? pontosFortes
              : ["Nenhum ponto forte crítico identificado."],
          gargalos:
            gargalos.length > 0
              ? gargalos
              : ["Nenhum gargalo crítico identificado."],
          sugestoes:
            sugestoes.length > 0
              ? sugestoes
              : ["Manter o acompanhamento regular das etapas."],
        },
      });

      await logAudit(
        "Gerar Relatório",
        "Relatórios",
        `Gerou relatório para a vaga: ${vaga.titulo}`,
      );
    } catch (err: any) {
      console.error("Erro ao gerar relatório:", err);
      setError("Ocorreu um erro ao processar os dados do relatório.");
    } finally {
      setGenerating(false);
    }
  };

  if (profile?.perfil !== "RH" && profile?.perfil !== "Admin") {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Acesso Negado
        </h2>
        <p className="text-slate-600">
          Esta seção é exclusiva para usuários com perfil de RH.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Relatórios Estratégicos
          </h2>
          <p className="text-slate-500">
            Análise detalhada e KPIs do processo seletivo
          </p>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Selecione uma Vaga
            </label>
            <div className="relative">
              <Briefcase className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select
                value={selectedVagaId}
                onChange={(e) => setSelectedVagaId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="">Selecione uma vaga...</option>
                {vagas.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.codigo_vaga ? `[${v.codigo_vaga}] ` : ""}
                    {v.titulo} ({v.departamento})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button
            onClick={generateReport}
            disabled={!selectedVagaId || generating}
            className="bg-primary text-white px-5 py-2.5 rounded-xl font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            <BarChart3 className="w-4 h-4" />
            {generating ? "Gerando..." : "Gerar Relatório"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mt-4">{error}</p>}
      </div>

      {reportData && (
        <div className="space-y-8">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Resumo Executivo da Vaga
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Visão consolidada da seleção encerrada.
                </p>
              </div>
              <Briefcase className="w-6 h-6 text-slate-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Vaga</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.titulo}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Código</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.codigoVaga || "Não informado"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Departamento</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.departamento || "Não informado"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Empresa / Unidade</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.empresa || "Não informado"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">RH Responsável</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.ownerNome || "Não informado"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Status Final</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.statusFinal || "Não informado"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Abertura</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.dataAbertura
                    ? new Date(
                        reportData.summary.dataAbertura,
                      ).toLocaleDateString("pt-BR")
                    : "Não informado"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Encerramento</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.dataEncerramento
                    ? new Date(
                        reportData.summary.dataEncerramento,
                      ).toLocaleDateString("pt-BR")
                    : "Não informado"}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Duração do Processo</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.duracaoDias} dias
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Qtd. Vagas</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.quantidadeVagas}
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Qtd. Contratada</p>
                <p className="font-semibold text-slate-900 mt-1">
                  {reportData.summary.quantidadeContratada}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="flex items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Resultado Final da Seleção
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  Desfecho da vaga e pessoas contratadas.
                </p>
              </div>
              <CheckCircle2 className="w-6 h-6 text-slate-400" />
            </div>

            {!reportData.resultadoFinal.houveContratacao ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-800">
                Não houve contratação final registrada para esta seleção.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 text-sm">
                  Total de contratados:{" "}
                  <span className="font-semibold">
                    {reportData.resultadoFinal.totalContratados}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {reportData.resultadoFinal.contratados.map((contratado) => (
                    <div
                      key={contratado.candidaturaId}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {contratado.nome}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            Candidato contratado
                          </p>
                        </div>
                        <User className="w-5 h-5 text-slate-400" />
                      </div>
                      <div className="space-y-2 text-sm text-slate-700">
                        <div className="flex items-center gap-2">
                          <Mail className="w-4 h-4 text-slate-400" />{" "}
                          {contratado.email}
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-4 h-4 text-slate-400" />{" "}
                          {contratado.telefone || "Não informado"}
                        </div>
                        <div>
                          <span className="text-slate-500">Fase final:</span>{" "}
                          {contratado.fase || "Não informado"}
                        </div>
                        <div>
                          <span className="text-slate-500">Status final:</span>{" "}
                          {contratado.status || "Não informado"}
                        </div>
                        <div>
                          <span className="text-slate-500">
                            Data da contratação:
                          </span>{" "}
                          {contratado.dataContratacao
                            ? new Date(
                                contratado.dataContratacao,
                              ).toLocaleDateString("pt-BR")
                            : "Não informado"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-slate-500">
                  Total de Candidatos
                </p>
                <Users className="w-5 h-5 text-primary" />
              </div>
              <h3 className="text-3xl font-bold text-slate-900">
                {reportData.stats.totalCandidatos}
              </h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-slate-500">
                  Taxa de Conversão Final
                </p>
                <Target className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-3xl font-bold text-slate-900">
                {reportData.stats.taxaConversaoFinal}%
              </h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-slate-500">
                  Tempo Médio Total
                </p>
                <Clock className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className="text-3xl font-bold text-slate-900">
                {reportData.stats.tempoMedioProcesso}d
              </h3>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm font-medium text-slate-500">
                  Contratados
                </p>
                <Award className="w-5 h-5 text-amber-500" />
              </div>
              <h3 className="text-3xl font-bold text-slate-900">
                {reportData.resultadoFinal.totalContratados}
              </h3>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-primary" />
                Funil da Seleção
              </h3>
              <div style={{ width: "100%", height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.stats.funilData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]}>
                      <LabelList dataKey="value" position="top" />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Tempo Médio por Etapa (Dias)
              </h3>
              <div style={{ width: "100%", height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={reportData.stats.tempoMedioPorEtapa}
                    layout="vertical"
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      horizontal={true}
                      vertical={false}
                    />
                    <XAxis type="number" hide />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={120}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Bar dataKey="dias" fill="#6366f1" radius={[0, 4, 4, 0]}>
                      <LabelList
                        dataKey="dias"
                        position="right"
                        style={{ fontSize: "12px", fontWeight: "bold" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500 mt-4 italic">
                * Calculado com base na diferença de tempo entre as
                movimentações de fase no histórico.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" />
                Prova Técnica / Avaliação
              </h3>
              {reportData.provas ? (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <p className="text-xs text-slate-500">Exigia prova?</p>
                    <p className="font-semibold text-slate-900 mt-1">
                      {reportData.provas.exigeProva ? "Sim" : "Não"}
                    </p>
                  </div>
                  {reportData.provas.exigeProva && (
                    <>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs text-slate-500">Prova</p>
                        <p className="font-semibold text-slate-900 mt-1">
                          {reportData.provas.nome || "Não informada"}
                        </p>
                      </div>
                      <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                        <p className="text-xs text-slate-500">Versão</p>
                        <p className="font-semibold text-slate-900 mt-1">
                          {reportData.provas.versao || "Não informada"}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500">
                            Participantes
                          </p>
                          <p className="font-semibold text-slate-900 mt-1">
                            {reportData.provas.totalParticipantes}
                          </p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500">Aprovados</p>
                          <p className="font-semibold text-slate-900 mt-1">
                            {reportData.provas.aprovados}
                          </p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500">Reprovados</p>
                          <p className="font-semibold text-slate-900 mt-1">
                            {reportData.provas.reprovados}
                          </p>
                        </div>
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500">Pendentes</p>
                          <p className="font-semibold text-slate-900 mt-1">
                            {reportData.provas.pendentes}
                          </p>
                        </div>
                      </div>
                      {reportData.provas.mediaNotas !== null && (
                        <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                          <p className="text-xs text-slate-500">
                            Média de Nota
                          </p>
                          <p className="font-semibold text-slate-900 mt-1">
                            {reportData.provas.mediaNotas}
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-500 text-sm">
                  Não há informações de prova para esta vaga.
                </div>
              )}
            </div>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-primary" />
                Análise e Recomendações
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-800 mb-2">
                    Pontos Fortes
                  </p>
                  <ul className="space-y-2 text-sm text-emerald-900 list-disc pl-5">
                    {reportData.analise.pontosFortes.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-800 mb-2">
                    Gargalos
                  </p>
                  <ul className="space-y-2 text-sm text-amber-900 list-disc pl-5">
                    {reportData.analise.gargalos.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-sm font-semibold text-sky-800 mb-2">
                    Sugestões
                  </p>
                  <ul className="space-y-2 text-sm text-sky-900 list-disc pl-5">
                    {reportData.analise.sugestoes.map((item, index) => (
                      <li key={index}>{item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
