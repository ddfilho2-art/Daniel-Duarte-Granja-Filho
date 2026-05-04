import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  Users,
  Shield,
  BarChart,
  Plus,
  Search,
  Activity,
  Ban,
  Snowflake,
  Unlock,
  CheckCircle2,
  Database,
  Eye,
  EyeOff,
  Filter,
  XCircle,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Briefcase,
  FileText,
  UserPlus,
  Repeat,
  Clock,
  AlertCircle,
  Check,
  Trash2,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { safeFetch } from "../lib/api";
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { TransferOwnerModal } from "../components/TransferOwnerModal";
import { useAuth } from "../contexts/AuthContext";
import { logAudit } from "../lib/audit";
import { AuditTrail } from "../components/AuditTrail";

const PRIMARY_COLORS = ["#0ea5e9", "#38bdf8", "#7dd3fc", "#bae6fd", "#e0f2fe"];

export function AdminDashboard() {
  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [metrics, setMetrics] = useState({
    totalTalentos: 0,
    vagasAtivas: 0,
    candidaturasMes: 0,
    usersTotais: 0,
    novosCandidatos24h: 0,
    loading: true,
  });

  const [cargaTrabalhoState, setCargaTrabalhoState] = useState<any[]>([]);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const fetchTotalTalentos = async () => {
          const { data, error } = await supabase
            .from("users")
            .select("id")
            .eq("perfil", "Candidato");
          if (error) throw error;
          return (data || []).length;
        };

        const fetchVagasAtivas = async () => {
          const { data, error } = await supabase
            .from("vagas")
            .select("id")
            .eq("status", "Aberta");
          if (error) throw error;
          return (data || []).length;
        };

        const fetchCandidaturasMes = async () => {
          const trintaDiasAtras = new Date();
          trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
          const { data, error } = await supabase
            .from("candidaturas")
            .select("id")
            .gte("data_candidatura", trintaDiasAtras.toISOString());
          if (error) throw error;
          return (data || []).length;
        };

        const fetchUsuariosTotais = async () => {
          const { data, error } = await supabase
            .from("users")
            .select("id")
            .in("perfil", ["RH", "Candidato"]);
          if (error) throw error;
          return (data || []).length;
        };

        const fetchNovosCandidatos24h = async () => {
          const vinteQuatroHorasAtras = new Date();
          vinteQuatroHorasAtras.setHours(vinteQuatroHorasAtras.getHours() - 24);
          const { data, error } = await supabase
            .from("users")
            .select("id")
            .eq("perfil", "Candidato")
            .gte("created_at", vinteQuatroHorasAtras.toISOString());
          if (error) throw error;
          return (data || []).length;
        };

        const fetchCargaTrabalho = async () => {
          const [vagasRes, usersRes] = await Promise.all([
            supabase.from("vagas").select("owner_nome").eq("status", "Aberta"),
            supabase
              .from("users")
              .select("nome")
              .eq("perfil", "RH")
              .eq("status", "Ativo"),
          ]);

          if (vagasRes.error) throw vagasRes.error;
          if (usersRes.error) throw usersRes.error;

          const rhUsers = usersRes.data || [];
          const cargaTrabalhoMap: { [key: string]: number } = {};

          rhUsers.forEach((user) => {
            cargaTrabalhoMap[user.nome] = 0;
          });

          (vagasRes.data || []).forEach((v: any) => {
            const nomeResponsavel = v.owner_nome || v.owner?.nome;
            if (
              nomeResponsavel &&
              cargaTrabalhoMap[nomeResponsavel] !== undefined
            ) {
              cargaTrabalhoMap[nomeResponsavel] += 1;
            }
          });

          return Object.keys(cargaTrabalhoMap)
            .map((key) => ({ name: key, vagas: cargaTrabalhoMap[key] }))
            .sort((a, b) => b.vagas - a.vagas);
        };

        const [
          totalTalentos,
          vagasAtivas,
          candidaturasMes,
          usersTotais,
          novosCandidatos24h,
          cargaTrabalho,
        ] = await Promise.all([
          fetchTotalTalentos(),
          fetchVagasAtivas(),
          fetchCandidaturasMes(),
          fetchUsuariosTotais(),
          fetchNovosCandidatos24h(),
          fetchCargaTrabalho(),
        ]);

        setMetrics({
          totalTalentos,
          vagasAtivas,
          candidaturasMes,
          usersTotais,
          novosCandidatos24h,
          loading: false,
        });
        setCargaTrabalhoState(cargaTrabalho);
      } catch (error) {
        console.error("Erro ao buscar métricas:", error);
        setMetrics((prev) => ({ ...prev, loading: false }));
      }
    };

    fetchMetrics();
  }, []);

  useEffect(() => {
    const fetchRecentLogs = async () => {
      try {
        const { data, error } = await supabase
          .from("logs")
          .select("*")
          .order("data", { ascending: false })
          .limit(5);

        if (error) throw error;
        setRecentLogs(data || []);
      } catch (error) {
        console.error("Erro ao buscar logs recentes:", error);
      } finally {
        setLoadingLogs(false);
      }
    };
    fetchRecentLogs();
  }, []);

  const formatTimeAgo = (dateStr: any) => {
    if (!dateStr) return "-";
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Agora mesmo";
    if (diffInSeconds < 3600)
      return `Há ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400)
      return `Há ${Math.floor(diffInSeconds / 3600)} horas`;
    return date.toLocaleDateString("pt-BR");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">
            Dashboard Administrativo
          </h1>
        </div>
      </div>

      {/* TOPO: KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total de Talentos
              </p>
              <h3 className="text-2xl font-bold text-slate-900">
                {metrics.loading ? "..." : metrics.totalTalentos}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600 shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Vagas Ativas</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {metrics.loading ? "..." : metrics.vagasAtivas}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-100 rounded-lg text-purple-600 shrink-0">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Candidaturas do Mês
              </p>
              <h3 className="text-2xl font-bold text-slate-900">
                {metrics.loading ? "..." : metrics.candidaturasMes}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-orange-100 rounded-lg text-orange-600 shrink-0">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Total de Usuários
              </p>
              <h3 className="text-2xl font-bold text-slate-900">
                {metrics.loading ? "..." : metrics.usersTotais}
              </h3>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-100 rounded-lg text-indigo-600 shrink-0">
              <UserPlus className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Novos Candidatos (24h)
              </p>
              <h3 className="text-2xl font-bold text-slate-900">
                {metrics.loading ? "..." : metrics.novosCandidatos24h}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* MEIO: Indicadores Secundários */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Usuários RH Ativos
              </p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                24
              </h3>
            </div>
          </div>
          <Link
            to="/admin/users"
            className="text-sm text-primary font-semibold hover:text-accent transition-colors mt-auto flex items-center gap-1 group"
          >
            Gerenciar usuários
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-50 rounded-lg text-emerald-600 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Acessos Hoje</p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                1,245
              </h3>
            </div>
          </div>
          <Link
            to="/admin/auditoria"
            className="text-sm text-primary font-semibold hover:text-accent transition-colors mt-auto flex items-center gap-1 group"
          >
            Ver logs de auditoria
            <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full hover:shadow-md transition-shadow">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-50 rounded-lg text-amber-600 shrink-0">
              <BarChart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">
                Vagas Preenchidas (Mês)
              </p>
              <h3 className="text-2xl font-bold text-slate-900 tracking-tight">
                18
              </h3>
            </div>
          </div>
          <div className="h-5" />
        </div>
      </div>

      {/* BASE: Gráficos e Análises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">
            Carga de Trabalho por Recrutador (Vagas Abertas)
          </h2>
          <div
            style={{
              width: "100%",
              height: 400,
              minHeight: 400,
              minWidth: 0,
            }}
            className="relative"
          >
            {cargaTrabalhoState.length > 0 ? (
              <div
                style={{
                  width: "100%",
                  height: "100%",
                  minHeight: 400,
                  minWidth: 0,
                  overflow: "hidden",
                }}
              >
                <ReBarChart
                  width={800}
                  height={400}
                  layout="vertical"
                  data={cargaTrabalhoState}
                  margin={{ top: 20, right: 60, left: 100, bottom: 20 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={true}
                    vertical={false}
                  />
                  <XAxis type="number" />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={90}
                    tick={{ fontSize: 11 }}
                    interval={0}
                  />
                  <Tooltip
                    cursor={{ fill: "#f1f5f9" }}
                    formatter={(value: number) => [
                      `${value} vagas`,
                      "Quantidade",
                    ]}
                    labelFormatter={(label: string) => `Recrutador: ${label}`}
                  />
                  <Bar dataKey="vagas" radius={[0, 4, 4, 0]} barSize={40}>
                    {cargaTrabalhoState.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={PRIMARY_COLORS[index % PRIMARY_COLORS.length]}
                      />
                    ))}
                    <LabelList
                      dataKey="vagas"
                      position="right"
                      fill="#64748b"
                      fontSize={12}
                    />
                  </Bar>
                </ReBarChart>
              </div>
            ) : (
              <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-500">
                Nenhuma vaga aberta no momento.
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">
              Últimas Atividades do Sistema
            </h2>
          </div>
          <div className="divide-y divide-slate-200 h-64 overflow-y-auto">
            {loadingLogs ? (
              <div className="p-6 text-center text-slate-500">
                Carregando atividades...
              </div>
            ) : recentLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-500">
                Nenhuma atividade registrada.
              </div>
            ) : (
              recentLogs.map((log) => (
                <div
                  key={log.id}
                  className="p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">
                        {log.acao}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Usuário: {log.usuarioEmail || log.usuarioId}
                      </p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    {formatTimeAgo(log.data)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminTransferencias() {
  const [vagas, setVagas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [transferModal, setTransferModal] = useState<{
    isOpen: boolean;
    vaga: any;
  }>({ isOpen: false, vaga: null });
  const [expiredTransfers, setExpiredTransfers] = useState<any[]>([]);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const checkExpiredTransfers = useCallback((vagasList: any[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired = vagasList.filter((v) => {
      if (!v.transferencia_ativa || !v.transferencia_temporaria) return false;
      if (!v.transferencia_temporaria.auto_retorno) return false;

      const dataRetorno = new Date(v.transferencia_temporaria.data_retorno);
      dataRetorno.setHours(0, 0, 0, 0);

      return dataRetorno <= today;
    });

    setExpiredTransfers(expired);
  }, []);

  const fetchVagas = useCallback(async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("vagas")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        throw error;
      }

      const vagasData = data || [];
      setVagas(vagasData);
      checkExpiredTransfers(vagasData);
    } catch (error) {
      console.error("Erro ao buscar vagas:", error);
    } finally {
      setLoading(false);
    }
  }, [checkExpiredTransfers]);

  useEffect(() => {
    fetchVagas();

    // Realtime subscription
    const channel = supabase
      .channel("vagas_admin_changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "vagas" },
        () => {
          fetchVagas();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchVagas]);

  const handleAutoReturn = async (vaga: any) => {
    try {
      setIsProcessingReturn(true);

      const { error: updateError } = await supabase
        .from("vagas")
        .update({
          owner_id: vaga.transferencia_temporaria.original_owner_id || null,
          owner_nome:
            vaga.transferencia_temporaria.original_owner_nome ||
            "Sem proprietário",
          transferencia_ativa: false,
          transferencia_tipo: null, // Limpa o tipo ao retornar ao original
          transferencia_temporaria: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", vaga.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase.from("transferencias").insert({
        vaga_id: vaga.id,
        tipo: "Retorno Automático",
        data_execucao: new Date().toISOString(),
        novo_owner_id: vaga.transferencia_temporaria.original_owner_id || null,
        novo_owner_nome:
          vaga.transferencia_temporaria.original_owner_nome ||
          "Sem proprietário",
        prev_owner_id: vaga.owner_id || null,
        prev_owner_nome: vaga.owner_nome || "Sem proprietário",
        justificativa:
          "Retorno automático de propriedade após o término do período de ausência temporária.",
        executado_por: "Sistema (Auto-retorno)",
        executado_por_id: "system",
      });

      if (logError) throw logError;

      await logAudit(
        "Retorno Automático de Proprietário",
        "Gestão de Transferências",
        `Retorno automático da vaga ${vaga.titulo} para ${vaga.transferencia_temporaria.original_owner_nome}`,
      );

      alert(
        `Vaga "${vaga.titulo}" retornada com sucesso para ${vaga.transferencia_temporaria.original_owner_nome}.`,
      );
    } catch (error) {
      console.error("Erro ao processar retorno automático:", error);
      alert("Erro ao processar retorno automático.");
    } finally {
      setIsProcessingReturn(false);
    }
  };

  const filteredVagas = vagas.filter((v) => {
    const matchesSearch =
      v.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (v.owner_nome &&
        v.owner_nome.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (v.codigo_vaga &&
        v.codigo_vaga.toLowerCase().includes(searchTerm.toLowerCase()));

    return matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Gestão de Transferências de Vagas
          </h1>
          <p className="text-slate-500">
            Transfira a propriedade de vagas entre recrutadores de forma
            temporária ou definitiva.
          </p>
        </div>
      </div>

      {/* Alertas de Transferências Expiradas */}
      {expiredTransfers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900">
              Transferências Temporárias Vencidas
            </h4>
            <p className="text-xs text-amber-700 mt-1">
              {expiredTransfers.length} vaga(s) possuem o prazo de retorno do
              proprietário original expirado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {expiredTransfers.map((vaga) => (
                <div
                  key={vaga.id}
                  className="flex items-center gap-2 bg-white border border-amber-200 px-3 py-1.5 rounded-lg text-xs shadow-sm"
                >
                  <span className="font-medium text-slate-700">
                    {vaga.titulo}
                  </span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">
                    Retorno:{" "}
                    {vaga.transferencia_temporaria?.original_owner_nome ||
                      "N/A"}
                  </span>
                  <button
                    onClick={() => handleAutoReturn(vaga)}
                    disabled={isProcessingReturn}
                    className="ml-2 bg-amber-600 text-white px-2 py-1 rounded hover:bg-amber-700 transition-colors disabled:opacity-50"
                  >
                    Processar Retorno
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 w-full max-w-md">
        <Search className="w-5 h-5 text-slate-400 ml-2" />
        <input
          type="text"
          placeholder="Buscar por cargo, ID ou recrutador..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-2 py-1 focus:outline-none text-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Vaga</th>
                <th className="px-6 py-4">Proprietário Atual</th>
                <th className="px-6 py-4">Status Transferência</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center">
                    Carregando vagas...
                  </td>
                </tr>
              ) : filteredVagas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center">
                    Nenhuma vaga encontrada.
                  </td>
                </tr>
              ) : (
                filteredVagas.map((vaga) => (
                  <tr
                    key={vaga.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">
                          {vaga.titulo}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {vaga.codigo_vaga || "-"}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {(() => {
                        const nome = vaga.owner_nome || "Sem proprietário";
                        return (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">
                              {nome.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-slate-700">
                              {nome}
                            </span>
                          </div>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4">
                      {vaga.transferencia_ativa ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 w-fit">
                            Temporária
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Retorno:{" "}
                            {new Date(
                              vaga.transferencia_temporaria?.data_retorno,
                            ).toLocaleDateString("pt-BR")}
                          </span>
                        </div>
                      ) : vaga.transferencia_tipo === "Definitiva" ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-100 text-purple-700 w-fit">
                          Definitiva
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">
                          Nenhuma transferência ativa
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={() => setTransferModal({ isOpen: true, vaga })}
                        className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                        title="Transferir Proprietário"
                      >
                        <Repeat className="w-5 h-5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {transferModal.isOpen && transferModal.vaga && (
        <TransferOwnerModal
          isOpen={transferModal.isOpen}
          onClose={() => setTransferModal({ isOpen: false, vaga: null })}
          vaga={transferModal.vaga}
          onSuccess={fetchVagas}
        />
      )}
    </div>
  );
}

export function AdminGestaoUsuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Todos");

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isInactivateModalOpen, setIsInactivateModalOpen] = useState(false);

  // Selected User for Actions
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // Form States
  const [formData, setFormData] = useState({
    nome: "",
    email: "",
    login: "",
    senha: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showSenha, setShowSenha] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("users")
        .select("*")
        .eq("perfil", "RH")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error("Erro ao buscar usuários:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sessão inválida ou expirada. Faça login novamente.");
      }

      const response = await safeFetch("/api/admin-create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          nome: formData.nome,
          email: formData.email,
          login: formData.login,
          senha: formData.senha,
        }),
      });

      if (!response.ok || !response.data?.success) {
        throw new Error(response.data?.message || "Erro ao criar usuário.");
      }

      setIsCreateModalOpen(false);
      setFormData({ nome: "", email: "", login: "", senha: "" });
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Erro ao criar usuário.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      if (!selectedUser?.id) {
        throw new Error("Usuário selecionado inválido.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sessão inválida ou expirada. Faça login novamente.");
      }

      const emailChanged =
        String(formData.email || "")
          .trim()
          .toLowerCase() !==
        String(selectedUser.email || "")
          .trim()
          .toLowerCase();

      const { error: dbError } = await supabase
        .from("users")
        .update({
          nome: formData.nome,
          updated_at: new Date().toISOString(),
        })
        .eq("id", selectedUser.id);

      if (dbError) throw dbError;

      if (emailChanged) {
        const response = await safeFetch("/api/admin-update-user-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            userId: selectedUser.id,
            email: formData.email,
          }),
        });

        if (!response.ok || !response.data?.success) {
          throw new Error(
            response.data?.message || "Erro ao atualizar e-mail do usuário.",
          );
        }
      }

      setIsEditModalOpen(false);
      await fetchUsers();
    } catch (err: any) {
      setError(err.message || "Erro ao editar usuário.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError("");

    try {
      if (!selectedUser?.id) {
        throw new Error("Usuário selecionado inválido.");
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Sessão inválida ou expirada. Faça login novamente.");
      }

      const response = await safeFetch("/api/admin-reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          userId: selectedUser.id,
          senha: formData.senha,
        }),
      });

      if (!response.ok || !response.data?.success) {
        throw new Error(response.data?.message || "Erro ao resetar senha.");
      }

      setIsResetModalOpen(false);
      setFormData((prev) => ({ ...prev, senha: "" }));
    } catch (err: any) {
      setError(err.message || "Erro ao resetar senha.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (user: any, newStatus: string) => {
    try {
      setStatusLoadingId(user.id);
      // Protocolo DFL: Se o status for inativar, use 'cancelado'
      const targetStatus = newStatus === "Inativo" ? "cancelado" : newStatus;

      const updateData: any = { status: targetStatus };
      if (targetStatus === "cancelado") {
        updateData.removed_at = new Date().toISOString();
      }

      console.log(
        `[OPS-RH] Executando status change para ${targetStatus} no ID ${user.id}`,
      );

      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", String(user.id)); // Força String no ID conforme protocolo

      if (error) throw error;

      // Sucesso imediato na UI (Trigger do banco cuida do log)
      await fetchUsers();

      // Feedback operacional solicitado
      if (targetStatus === "cancelado") {
        alert(
          "Status atualizado com sucesso no banco. O log de auditoria aparecerá em breve.",
        );
      }
    } catch (err) {
      console.error("[OPS-FATAL] Falha na alteração de status:", err);
      alert("Erro operacional: Não foi possível alterar o status do usuário.");
    } finally {
      setStatusLoadingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.login.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === "Todos" || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Gestão de Usuários RH
          </h1>
          <p className="text-slate-500 text-sm">
            Gerencie os recrutadores e administradores do sistema.
          </p>
        </div>
        <button
          onClick={() => {
            setFormData({ nome: "", email: "", login: "", senha: "" });
            setIsCreateModalOpen(true);
          }}
          className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Novo Usuário RH
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por nome, email ou login..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white sm:text-sm font-medium"
        >
          <option value="Todos">Todos os Status</option>
          <option value="Ativo">Ativo</option>
          <option value="Congelado">Congelado</option>
          <option value="cancelado">Cancelado</option>
        </select>
      </div>

      {/* Tabela */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Email / Login</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Criação</th>
                <th className="px-6 py-4 text-center">Remoção</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Carregando usuários...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Nenhum usuário encontrado.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{u.nome}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600">{u.email}</div>
                      <div className="text-[10px] font-mono text-slate-400 uppercase">
                        {u.login}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                          u.status === "Ativo"
                            ? "bg-emerald-100 text-emerald-700"
                            : u.status === "Congelado"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-red-100 text-[#ED1C24]"
                        }`}
                      >
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString("pt-BR")}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-500 font-medium">
                      {u.status === "cancelado" ||
                      u.status?.toUpperCase() === "INATIVO"
                        ? new Date(
                            u.removed_at || u.updated_at || new Date(),
                          ).toLocaleDateString("pt-BR")
                        : "-"}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {statusLoadingId === u.id ? (
                          <div className="flex items-center gap-2 text-[#0054A6] animate-pulse">
                            <span className="text-[10px] font-bold uppercase">
                              Processando...
                            </span>
                          </div>
                        ) : (
                          u.status !== "cancelado" && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setFormData({
                                    nome: u.nome,
                                    email: u.email,
                                    login: u.login,
                                    senha: "",
                                  });
                                  setIsEditModalOpen(true);
                                }}
                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setFormData((prev) => ({
                                    ...prev,
                                    senha: "",
                                  }));
                                  setIsResetModalOpen(true);
                                }}
                                className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Resetar Senha"
                              >
                                <Unlock className="w-4 h-4" />
                              </button>
                              {u.status === "Ativo" ? (
                                <button
                                  onClick={() =>
                                    handleStatusChange(u, "Congelado")
                                  }
                                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                  title="Congelar"
                                >
                                  <Snowflake className="w-4 h-4" />
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleStatusChange(u, "Ativo")}
                                  className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                                  title="Ativar"
                                >
                                  <CheckCircle2 className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  setSelectedUser(u);
                                  setIsInactivateModalOpen(true);
                                }}
                                className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Cancelar Usuário"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            </>
                          )
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

      {/* Modal Criar */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                Novo Usuário RH
              </h3>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nome Completo
                </label>
                <input
                  required
                  type="text"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Email Corporativo
                </label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Login de Acesso
                </label>
                <input
                  required
                  type="text"
                  value={formData.login}
                  onChange={(e) =>
                    setFormData({ ...formData, login: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                  placeholder="Ex: joao.silva"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Senha Inicial
                </label>
                <div className="relative">
                  <input
                    required
                    type={showSenha ? "text" : "password"}
                    value={formData.senha}
                    onChange={(e) =>
                      setFormData({ ...formData, senha: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showSenha ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="pt-4">
                <button
                  disabled={isSaving}
                  type="submit"
                  className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Criando..." : "Criar Usuário"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Editar */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                Editar Usuário
              </h3>
              <button
                onClick={() => setIsEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nome Completo
                </label>
                <input
                  required
                  type="text"
                  value={formData.nome}
                  onChange={(e) =>
                    setFormData({ ...formData, nome: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Email
                </label>
                <input
                  required
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData({ ...formData, email: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none"
                />
              </div>
              <div className="pt-4">
                <button
                  disabled={isSaving}
                  type="submit"
                  className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Salvando..." : "Salvar Alterações"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reset Senha */}
      {isResetModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <h3 className="text-lg font-bold text-slate-900">
                Resetar Senha
              </h3>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Defina uma nova senha para o usuário{" "}
                <strong>{selectedUser?.login}</strong>.
              </p>
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">
                  {error}
                </div>
              )}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    required
                    type={showSenha ? "text" : "password"}
                    value={formData.senha}
                    onChange={(e) =>
                      setFormData({ ...formData, senha: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSenha(!showSenha)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {showSenha ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
              <div className="pt-4">
                <button
                  disabled={isSaving}
                  type="submit"
                  className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors disabled:opacity-50"
                >
                  {isSaving ? "Resetando..." : "Confirmar Novo Reset"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cancelar */}
      {isInactivateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Ban className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">
              Cancelar Usuário
            </h3>
            <p className="text-slate-600 mb-6">
              Você tem certeza que deseja cancelar o acesso de{" "}
              <strong>{selectedUser?.nome}</strong>? <br />
              <span className="text-red-600 font-bold text-xs uppercase mt-2 block">
                Usuários cancelados não podem ser reativados pelo RH.
              </span>
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsInactivateModalOpen(false)}
                className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-200 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  handleStatusChange(selectedUser, "Inativo");
                  setIsInactivateModalOpen(false);
                }}
                className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors"
              >
                Sim, Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function AdminPlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500">Esta página está em construção.</p>
    </div>
  );
}

export function AdminAuditoria() {
  return <AuditTrail />;
}
