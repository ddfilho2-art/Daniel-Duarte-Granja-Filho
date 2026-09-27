import React, { useState, useEffect, useCallback } from "react";
import {
  Activity,
  Clock,
  AlertTriangle,
  Zap,
  Database,
  Bell,
  Server,
  Code,
  ShieldCheck,
  Layers,
  Gauge,
  CheckCircle2,
  RefreshCw,
  Users,
  Briefcase,
  AlertCircle,
  Mail,
} from "lucide-react";
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ChartTooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
} from "recharts";
import { supabase } from "../lib/supabase";
import { safeFetch } from "../lib/api";

// --- DATA STRUCTURES ---
interface SREMetrics {
  overview?: {
    total_usuarios?: number;
    usuarios_congelados?: number;
    vagas_ativas?: number; // v6.2
    intervencoes_criticas?: number; // v6.2
    uptime_real?: number; // v6.2
    grafico_performance?: { name: string; valor: number }[];
  };
  pontos_criticos?: {
    endpoints_lentos?: { rota: string; latencia: string }[];
    usuarios_congelados?: number;
  };
  database?: {
    tamanho_cache?: string;
    conexoes_ativas?: number;
  };
  observabilidade?: {
    metricas?: { nome: string; valor: string; status: string }[];
  };
  alertas_slos?: {
    lista_alertas?: { titulo: string; status: string; erro: string }[];
  };
}

const TABS = [
  { id: "overview", label: "Overview", icon: Gauge },
  { id: "critical", label: "Pontos Críticos", icon: AlertTriangle },
  { id: "database", label: "Banco de Dados", icon: Database },
  { id: "observability", label: "Observabilidade", icon: Layers },
  { id: "slos", label: "Alertas & SLOs", icon: Bell },
  { id: "emails", label: "E-mails", icon: Mail },
];

// --- SKELETON (DFL STYLE) ---
const KPISkeleton = () => (
  <div className="bg-white p-7 rounded-xl border border-[#E2E8F0] animate-pulse">
    <div className="flex justify-between items-start mb-6">
      <div className="w-12 h-12 bg-[#F1F5F9] rounded-lg" />
      <div className="w-20 h-5 bg-[#F1F5F9] rounded-full" />
    </div>
    <div className="space-y-3">
      <div className="w-32 h-3 bg-[#F1F5F9] rounded" />
      <div className="w-24 h-9 bg-[#F1F5F9] rounded" />
    </div>
  </div>
);

// --- TABS ---

/**
 * ABA OVERVIEW: FLUXO RPC (LATÊNCIA ZERO)
 */
const OverviewTab = ({
  data,
  loading,
}: {
  data: SREMetrics | null;
  loading: boolean;
}) => {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in">
        {Array(4)
          .fill(0)
          .map((_, i) => (
            <KPISkeleton key={i} />
          ))}
      </div>
    );
  }

  // Fallback seguro em caso de nulos (Poka-Yoke)
  const overviewData = data?.overview || {};

  const signals = [
    {
      label: "Uptime Global",
      valor: `${overviewData.uptime_real ?? 0}%`,
      icon: Activity,
      isAlert: false,
    },
    {
      label: "Total de Usuários",
      valor: String(overviewData.total_usuarios ?? 0),
      icon: Users,
      isAlert: false,
    },
    {
      label: "Vagas Abertas",
      valor: String(overviewData.vagas_ativas ?? 0),
      icon: Briefcase,
      isAlert: false,
    },
    {
      label: "Intervenções Críticas (24h)",
      valor: String(overviewData.intervencoes_criticas ?? 0),
      icon: AlertTriangle,
      isAlert: Number(overviewData.intervencoes_criticas) > 0,
    },
  ];

  const chartData = overviewData.grafico_performance || [];

  return (
    <div className="space-y-10 animate-in slide-in-from-bottom-2 duration-400">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {signals.map((s) => (
          <div
            key={s.label}
            className={`bg-white p-7 rounded-xl border shadow-sm transition-all group ${
              s.isAlert
                ? "border-[#ED1C24]/30 hover:border-[#ED1C24]/60 bg-red-50/10"
                : "border-[#E2E8F0] hover:border-[#0054A6]/40"
            }`}
          >
            <div className="flex justify-between items-start mb-6">
              <div
                className={`p-3 rounded-lg transition-colors ${
                  s.isAlert
                    ? "bg-red-100 text-[#ED1C24]"
                    : "bg-[#F1F5F9] text-[#0054A6] group-hover:bg-[#0054A6] group-hover:text-white"
                }`}
              >
                <s.icon className="w-6 h-6" />
              </div>
              <span
                className={`text-[9px] font-bold px-2.5 py-1 rounded-full uppercase tracking-tighter border ${
                  s.isAlert
                    ? "bg-red-50 text-[#ED1C24] border-red-200"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200"
                }`}
              >
                {s.isAlert ? "WARNING" : "HEALTHY"}
              </span>
            </div>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              {s.label}
            </p>
            <h3
              className={`text-3xl font-bold tracking-tighter italic ${
                s.isAlert ? "text-[#ED1C24]" : "text-[#1A1A1A]"
              }`}
            >
              {s.valor}
            </h3>
          </div>
        ))}
      </div>

      {/* GRÁFICO DINÂMICO (Restauração RPC v6.1) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white p-8 rounded-xl border border-[#E2E8F0] shadow-sm h-[400px]">
          <h3 className="text-xs font-bold text-[#1A1A1A] uppercase tracking-widest italic mb-8 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-[#0054A6]" />
              Live Latency Stream (ms)
            </div>
            <span className="text-[9px] text-[#00A859] animate-pulse">
              ● RPC STREAM
            </span>
          </h3>
          <div
            style={{
              height: "350px",
              width: "100%",
              minHeight: "350px",
              minWidth: 0,
            }}
            className="mt-4 flex items-center justify-center"
          >
            {chartData.length > 0 ? (
              <div className="h-full w-full min-h-[350px] min-w-0">
                <ResponsiveContainer
                  width="100%"
                  height={350}
                  minWidth={300}
                  minHeight={350}
                >
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorDfl" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor="#0054A6"
                          stopOpacity={0.1}
                        />
                        <stop
                          offset="95%"
                          stopColor="#0054A6"
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      vertical={false}
                      stroke="#0054A6"
                      strokeOpacity={0.1}
                    />
                    <XAxis
                      dataKey="name"
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      dataKey="valor"
                      fontSize={10}
                      axisLine={false}
                      tickLine={false}
                    />
                    <ChartTooltip
                      contentStyle={{
                        borderRadius: "12px",
                        border: "none",
                        boxShadow: "0 8px 16px rgba(0,0,0,0.08)",
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="valor"
                      stroke="#0054A6"
                      fillOpacity={1}
                      fill="url(#colorDfl)"
                      strokeWidth={3}
                      animationDuration={1000}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-full w-full items-center justify-center rounded-xl border border-dashed border-[#E2E8F0] bg-[#F8FAFC] text-sm font-medium text-slate-500">
                Sem dados de performance no período.
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#1A1A1A] p-8 rounded-xl relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <Zap className="w-32 h-32 text-[#00A859]" />
          </div>
          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4">
            SRE Fast-Track Validation
          </h4>
          <h3 className="text-2xl font-bold text-white tracking-tighter italic mb-6">
            Operação RPC ativa. Latência resolvida no servidor.
          </h3>
          <div className="flex flex-col gap-4">
            <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-[#00A859] uppercase italic flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Server className="w-4 h-4" /> Zero-Calc Client
              </span>
              <span>ON</span>
            </div>
            <div className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-xs font-bold text-white uppercase italic flex items-center justify-between">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> DFL Protocol v6.1
              </span>
              <span className="text-[#0054A6]">READY</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const CriticalTab = ({
  data,
  loading,
}: {
  data: SREMetrics | null;
  loading: boolean;
}) => {
  if (loading)
    return (
      <div className="animate-pulse flex gap-4">
        <KPISkeleton />
        <KPISkeleton />
      </div>
    );

  const frozenUsers =
    data?.pontos_criticos?.usuarios_congelados ||
    data?.overview?.usuarios_congelados ||
    0;
  const hasCriticals = frozenUsers > 0;
  const endpoints = data?.pontos_criticos?.endpoints_lentos || [];

  return (
    <div className="space-y-8 animate-in slide-in-from-right-4 duration-400">
      <div
        className={`p-10 rounded-2xl border relative overflow-hidden ${hasCriticals ? "bg-red-50 border-red-200 border-l-4 border-l-[#ED1C24]" : "bg-[#F8FAFC] border-[#E2E8F0] border-l-4 border-l-[#0054A6]"}`}
      >
        <div
          className={`absolute top-0 right-0 p-10 opacity-5 ${hasCriticals ? "text-[#ED1C24]" : "text-[#0054A6]"}`}
        >
          <AlertTriangle className="w-40 h-40" />
        </div>
        <div className="relative z-10">
          <h2
            className={`text-2xl font-bold uppercase italic tracking-tight mb-4 flex items-center gap-3 ${hasCriticals ? "text-[#ED1C24]" : "text-[#1A1A1A]"}`}
          >
            <AlertTriangle className="w-8 h-8" />
            Análise de Pontos Críticos (RPC)
          </h2>
          <p className="text-slate-600 max-w-2xl text-sm font-medium leading-relaxed">
            Relatório instantâneo gerado pelo Supabase. O processamento é
            realizado DENTRO do banco de dados para evitar gargalos no frontend.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div
          className={`p-8 rounded-xl border shadow-sm ${hasCriticals ? "bg-red-50/30 border-red-200" : "bg-white border-[#E2E8F0]"}`}
        >
          <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-6">
            Usuários em Risco / Estagnados
          </h4>
          <div className="flex items-center gap-6">
            <h5
              className={`text-6xl font-bold tracking-tighter italic ${hasCriticals ? "text-[#ED1C24]" : "text-[#0054A6]"}`}
            >
              {frozenUsers}
            </h5>
            <span className="text-xs font-bold text-slate-500 uppercase max-w-[200px]">
              Contas com status "congelado" ou inativo por longo período.
            </span>
          </div>
        </div>

        <div className="p-8 bg-white rounded-xl border border-[#E2E8F0] shadow-sm">
          <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-6">
            Endpoints P99 &gt; 500ms
          </h4>
          {endpoints.length > 0 ? (
            <div className="space-y-4">
              {endpoints.map((e, idx) => (
                <div
                  key={idx}
                  className="flex justify-between items-center p-4 bg-[#F8FAFC] rounded-lg border border-[#E2E8F0]"
                >
                  <span className="text-xs font-mono font-bold text-[#1A1A1A]">
                    {e.rota}
                  </span>
                  <span className="text-sm font-bold text-[#ED1C24]">
                    {e.latencia}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
              <CheckCircle2 className="w-8 h-8 text-[#00A859] mx-auto mb-3" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">
                Todos OS NODES ESTÁVEIS
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const DatabaseTab = ({
  data,
  loading,
}: {
  data: SREMetrics | null;
  loading: boolean;
}) => {
  const [infraData, setInfraData] = useState<any>(null);
  const [infraLoading, setInfraLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("get_infra_usage").then(({ data: rpcData, error }) => {
      if (rpcData) {
        setInfraData(Array.isArray(rpcData) ? rpcData[0] : rpcData);
      } else if (error) {
        console.error("Erro ao buscar get_infra_usage", error);
      }
      setInfraLoading(false);
    });
  }, []);

  if (loading || infraLoading)
    return (
      <div className="animate-pulse flex gap-4">
        <KPISkeleton />
      </div>
    );
  const dbData = data?.database || {};
  const dbPercent = Number(infraData?.db_percent) || 0;
  const stPercent = Number(infraData?.st_percent) || 0;

  const getBarColor = (percent: number) => {
    if (percent < 70) return "bg-[#00A859]";
    if (percent < 90) return "bg-[#F8971D]";
    return "bg-[#ED1C24]";
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in slide-in-from-right-4 duration-400">
      <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] shadow-sm">
        <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-6 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#0054A6]" /> Cache Size
        </h4>
        <h3 className="text-4xl font-bold tracking-tighter italic text-[#1A1A1A]">
          {dbData.tamanho_cache || "14 MB"}
        </h3>
      </div>
      <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] shadow-sm">
        <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-6 flex items-center gap-2">
          <Activity className="w-4 h-4 text-[#00A859]" /> Conexões Ativas
        </h4>
        <h3 className="text-4xl font-bold tracking-tighter italic text-[#1A1A1A]">
          {dbData.conexoes_ativas || 12}
        </h3>
      </div>

      <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
        <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-6 flex items-center gap-2">
          <Database className="w-4 h-4 text-[#0054A6]" /> Ocupação do Banco de
          Dados
        </h4>
        <div>
          <h3 className="text-4xl font-bold tracking-tighter italic text-[#1A1A1A] mb-4">
            {infraData?.db_used_str} / {infraData?.db_limit_str}
          </h3>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${getBarColor(dbPercent)} transition-all duration-1000`}
              style={{ width: `${dbPercent}%` }}
            />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
            {dbPercent}% utilizado
          </p>
        </div>
      </div>

      <div className="bg-white p-8 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-between">
        <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-6 flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#0054A6]" /> Armazenamento Global
          (Storage)
        </h4>
        <div>
          <h3 className="text-4xl font-bold tracking-tighter italic text-[#1A1A1A] mb-4">
            {infraData?.st_used_str} / {infraData?.st_limit_str}
          </h3>
          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className={`h-full ${getBarColor(stPercent)} transition-all duration-1000`}
              style={{ width: `${stPercent}%` }}
            />
          </div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-2">
            {stPercent}% utilizado
          </p>
        </div>
      </div>
    </div>
  );
};

const ObservabilityTab = ({
  loading: initialLoading,
}: {
  data: SREMetrics | null;
  loading: boolean;
}) => {
  const [obsData, setObsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.rpc("get_observability_telemetry").then(({ data, error }) => {
      if (data) {
        setObsData(Array.isArray(data) ? data[0] : data);
      } else if (error) {
        console.error("Erro ao buscar get_observability_telemetry", error);
      }
      setLoading(false);
    });
  }, []);

  if (initialLoading || loading)
    return (
      <div className="animate-pulse flex gap-4">
        <KPISkeleton />
        <KPISkeleton />
      </div>
    );

  const healthScore = obsData?.health_score ?? 100;
  const criticalCount = obsData?.critical_count || 0;
  const incidents = obsData?.incidents || [];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-400">
      <h3 className="text-xl font-bold text-[#1A1A1A] uppercase italic mb-6 flex items-center gap-3">
        <Layers className="text-[#0054A6] w-6 h-6" /> Telemetria de
        Observabilidade
      </h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm flex items-center gap-6">
          <div
            className={`p-6 rounded-full border-4 flex items-center justify-center w-24 h-24 ${healthScore > 80 ? "border-[#00A859] text-[#00A859]" : healthScore > 50 ? "border-[#F8971D] text-[#F8971D]" : "border-[#ED1C24] text-[#ED1C24]"}`}
          >
            <span className="text-3xl font-bold tracking-tighter">
              {healthScore}%
            </span>
          </div>
          <div>
            <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-1">
              Disponibilidade Operacional
            </h4>
            <p className="text-2xl font-bold text-[#1A1A1A] tracking-tighter italic">
              Saúde do Sistema
            </p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl border border-[#E2E8F0] shadow-sm flex flex-col justify-center">
          <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-widest mb-2 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#ED1C24]" /> Incidentes
            Críticos (24h)
          </h4>
          <span
            className={`text-5xl font-bold tracking-tighter italic ${criticalCount > 0 ? "text-[#ED1C24]" : "text-[#00A859]"}`}
          >
            {criticalCount}
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm p-6 mt-6">
        <h4 className="text-[11px] font-bold text-[#1A1A1A] uppercase tracking-widest mb-4">
          Lista de Eventos
        </h4>
        {incidents.length > 0 ? (
          <ul className="divide-y divide-slate-100">
            {incidents.map((inc: any, idx: number) => (
              <li key={idx} className="py-3 flex items-start gap-4 text-sm">
                <span className="font-mono text-xs text-slate-400 shrink-0 whitespace-nowrap">
                  [
                  {inc.hora ||
                    inc.created_at ||
                    new Date().toLocaleTimeString("pt-BR")}
                  ]
                </span>
                <span
                  className={`font-bold shrink-0 ${inc.tipo?.toLowerCase().includes("error") || inc.tipo?.toLowerCase().includes("crítico") ? "text-[#ED1C24]" : "text-slate-600"}`}
                >
                  - [{inc.tipo || "LOG"}]:
                </span>
                <span className="text-slate-700">
                  {inc.mensagem || inc.message}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-8 text-center bg-[#F8FAFC] rounded-xl border border-[#E2E8F0]">
            <CheckCircle2 className="w-8 h-8 text-[#00A859] mx-auto mb-3" />
            <p className="text-sm font-bold text-[#00A859] uppercase tracking-widest">
              Sistema Estável - Nenhum log crítico
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

const SlosTab = ({
  data,
  loading,
}: {
  data: SREMetrics | null;
  loading: boolean;
}) => {
  if (loading)
    return (
      <div className="animate-pulse flex gap-4">
        <KPISkeleton />
      </div>
    );
  const alertas = data?.alertas_slos?.lista_alertas || [];

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-400">
      <h3 className="text-xl font-bold text-[#1A1A1A] uppercase italic mb-6 flex items-center gap-3">
        <Bell className="text-[#F8971D] w-6 h-6" /> Alertas e SLOs
      </h3>
      <div className="space-y-4">
        {alertas.length > 0 ? (
          alertas.map((alerta, idx) => (
            <div
              key={idx}
              className="bg-white p-6 rounded-xl border border-l-4 border-l-[#ED1C24] border-[#E2E8F0] shadow-sm flex items-center gap-6"
            >
              <div className="bg-red-50 p-3 rounded-lg text-[#ED1C24]">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-[#1A1A1A] uppercase tracking-widest">
                  {alerta.titulo}
                </span>
                <span className="text-sm font-medium text-slate-600 mt-1">
                  {alerta.erro}
                </span>
              </div>
              <div className="ml-auto">
                <span className="bg-[#ED1C24] text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase shadow-sm">
                  {alerta.status}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="p-16 border-2 border-dashed border-[#00A859]/30 bg-[#00A859]/5 rounded-xl text-center">
            <CheckCircle2 className="w-12 h-12 text-[#00A859] mx-auto mb-4" />
            <h4 className="text-lg font-bold text-[#00A859] uppercase italic tracking-tighter">
              Zero Alertas Ativos
            </h4>
            <p className="text-sm font-medium text-slate-600 mt-2">
              Todos os SLOs estão sendo cumpridos com precisão.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

function EmailMonitor() {
  const [emailQueue, setEmailQueue] = useState<any[]>([]);
  const [loadingEmails, setLoadingEmails] = useState(false);
  const [emailLogs, setEmailLogs] = useState<any[]>([]);
  const [activeSubTab, setActiveSubTab] = useState<"queue" | "history">(
    "queue",
  );

  async function fetchEmailQueue() {
    try {
      setLoadingEmails(true);

      const queueResponse = await safeFetch("/api/email-monitor");
      if (!queueResponse.ok) {
        throw new Error(
          queueResponse.data?.message ||
            queueResponse.data?.code ||
            "Não foi possível carregar a fila de e-mails.",
        );
      }
      setEmailQueue(queueResponse.data?.queue || []);

      const { data: logData, error: logError } = await supabase
        .from("logs")
        .select("*")
        .or("acao.eq.Enviou Convite,acao.eq.Enviou Mensagem Talentos")
        .order("data", { ascending: false })
        .limit(20);

      if (logError) throw logError;
      setEmailLogs(logData || []);
    } catch (err) {
      console.error("Erro ao buscar dados:", err);
    } finally {
      setLoadingEmails(false);
    }
  }

  useEffect(() => {
    fetchEmailQueue();
    const interval = setInterval(fetchEmailQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  async function handleRetry() {
    try {
      setLoadingEmails(true);
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (!accessToken) {
        throw new Error("Sessão expirada. Faça login novamente.");
      }

      const response = await safeFetch("/api/retry-emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const result = await response.data;
      alert(
        `✅ ${result?.processed || 0} e-mails processados. Sucesso: ${result?.sent || 0}, Falhas: ${result?.failed || 0}`,
      );
      await fetchEmailQueue();
    } catch (e: any) {
      console.error("Erro ao reprocessar:", e);
      alert("❌ Erro ao reprocessar e-mails: " + e.message);
    } finally {
      setLoadingEmails(false);
    }
  }

  const pendingCount = emailQueue.filter(
    (e: any) => e.status === "pending",
  ).length;
  const sentCount = emailQueue.filter((e: any) => e.status === "sent").length;
  const failedCount = emailQueue.filter(
    (e: any) => e.status === "failed",
  ).length;

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-400">
      <div className="p-6 border-b border-slate-200 bg-slate-50 rounded-t-xl">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Mail className="w-5 h-5 text-primary" />
          Monitoramento de E-mails
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Acompanhe e reprocesse e-mails parados ou falhos na fila.
        </p>
      </div>

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

// --- COMPONENTE PRINCIPAL ---

export function PerformanceSRE() {
  const [activeTab, setActiveTab] = useState("overview");
  const [metrics, setMetrics] = useState<SREMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastSync, setLastSync] = useState<string>("---");

  /**
   * FLUXO ÚNICO DFL V6.1: RPC Latência Zero (Poka-Yoke + JSON Mapping)
   */
  const fetchRPCMetrics = useCallback(async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase.rpc("get_sre_dashboard_metrics");

      if (error) {
        console.error("Erro ao buscar get_sre_dashboard_metrics", error);
      }

      if (data) {
        setMetrics(data as SREMetrics);
      }

      // Sincronização Fuso Horário RJ (UTC-3)
      setLastSync(
        new Date().toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
        }),
      );
    } catch (err: any) {
      console.error("[SRE-SYNC-FATAL]", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync Automático & Inicial
  useEffect(() => {
    fetchRPCMetrics();
    // RPC-Pull a cada 30 segundos
    const interval = setInterval(fetchRPCMetrics, 30000);
    return () => clearInterval(interval);
  }, [fetchRPCMetrics]);

  return (
    <div className="space-y-8 animate-in fade-in duration-300 font-sans p-6 md:p-10 bg-white min-h-screen">
      {/* HEADER RPC-SYNC */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 pb-10 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-6">
          <div className="p-4 bg-[#0054A6] text-white rounded-2xl shadow-xl border border-[#0054A6]/10">
            <Gauge className="w-10 h-10" />
          </div>
          <div>
            <h1 className="text-4xl font-bold text-[#1A1A1A] tracking-tighter uppercase italic">
              Performance & SRE
            </h1>
            <div className="flex items-center gap-3 mt-1.5 text-[#4D4D4D] text-[10px] font-bold">
              <span className="flex items-center gap-1.5 uppercase tracking-widest bg-[#F1F5F9] px-2.5 py-1 rounded border border-[#E2E8F0] shadow-sm text-[#0054A6]">
                <Database className="w-3 h-3" /> PUSH: RPC Data Layer
              </span>
              <span className="opacity-60 italic flex items-center gap-2">
                <RefreshCw
                  className={`w-3 h-3 ${loading ? "animate-spin" : ""}`}
                />
                Sync Worker (RJ): {lastSync}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            onClick={fetchRPCMetrics}
            className="p-3 text-[#4D4D4D] hover:text-[#0054A6] transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
          </button>
          <div className="flex items-center gap-3 py-2 px-6 bg-[#F1F5F9] border border-[#E2E8F0] rounded-full shadow-inner">
            <div className="w-2.5 h-2.5 bg-[#00A859] rounded-full shadow-[0_0_8px_#00A859]" />
            <span className="text-[10px] font-bold text-[#1A1A1A] uppercase tracking-widest">
              Zero-Calc Active
            </span>
          </div>
        </div>
      </div>

      {/* TABS (LAZY LOADING MANTIDO) */}
      <div className="flex flex-wrap gap-2 p-1.5 bg-[#F1F5F9] rounded-2xl w-fit border border-[#E2E8F0] mb-6 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
              activeTab === tab.id
                ? "bg-white text-[#0054A6] shadow-md ring-1 ring-[#0054A6]/20"
                : "text-[#4D4D4D] hover:text-[#1A1A1A] hover:bg-white/40"
            }`}
          >
            <tab.icon
              className={`w-4 h-4 ${activeTab === tab.id ? "text-[#0054A6]" : ""}`}
            />
            {tab.label}
          </button>
        ))}
      </div>

      {/* RENDERIZAÇÃO ABAS RESTAURADAS RPC */}
      <div className="relative pt-2 min-h-[500px]">
        {activeTab === "overview" && (
          <OverviewTab data={metrics} loading={loading} />
        )}
        {activeTab === "critical" && (
          <CriticalTab data={metrics} loading={loading} />
        )}
        {activeTab === "database" && (
          <DatabaseTab data={metrics} loading={loading} />
        )}
        {activeTab === "observability" && (
          <ObservabilityTab data={metrics} loading={loading} />
        )}
        {activeTab === "slos" && <SlosTab data={metrics} loading={loading} />}
        {activeTab === "emails" && <EmailMonitor />}
      </div>

      {/* FOOTER DFL STRUCTURAL */}
      <div className="pt-24 border-t border-[#E2E8F0]">
        <div className="bg-[#1A1A1A] border border-[#222] rounded-[3rem] p-12 relative overflow-hidden group shadow-[0_30px_60px_-12px_rgba(0,0,0,0.5)]">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#0054A6]/10 rounded-full blur-[120px] -mr-32 -mt-32 transition-all duration-1000 group-hover:bg-[#00A859]/10" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-16 relative z-10">
            <div className="flex flex-col sm:flex-row items-center gap-10">
              <div className="p-7 bg-white/5 border border-white/10 rounded-[2rem] text-[#0054A6] shadow-2xl animate-pulse">
                <ShieldCheck className="w-14 h-14" />
              </div>
              <div className="space-y-4 text-center sm:text-left">
                <h3 className="text-3xl font-bold text-white tracking-tighter uppercase italic flex flex-wrap items-center justify-center sm:justify-start gap-4">
                  DFL Latency Protocol v6.1
                  <span className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-widest text-[#00A859] bg-[#00A859]/10 px-5 py-2 rounded-full border border-[#00A859]/20">
                    <CheckCircle2 className="w-4 h-4" />
                    RPC Active Layer
                  </span>
                </h3>
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-8 text-slate-500 text-[11px] font-bold uppercase tracking-widest">
                  <span className="flex items-center gap-2">
                    <Code className="w-4 h-4 text-[#0054A6]" /> Payload: JSON
                    Structured
                  </span>
                  <div className="hidden sm:block w-1.5 h-1.5 bg-slate-700 rounded-full" />
                  <span className="flex items-center gap-2">
                    <Server className="w-4 h-4" /> Error Handling: Non-Blocking
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
