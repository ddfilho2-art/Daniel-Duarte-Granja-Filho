import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  BarChart3, PieChart as PieChartIcon, TrendingUp, Target, Clock, Users, 
  FileCheck, AlertCircle, CheckCircle2, ArrowLeft, Download, Filter,
  ChevronRight, Calendar, Building2, Briefcase, Award, MessageSquare,
  Activity, Zap, Info
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, 
  ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, 
  AreaChart, Area, FunnelChart, Funnel, LabelList
} from 'recharts';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../lib/audit';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

interface ReportData {
  vaga: any;
  stats: {
    totalCandidatos: number;
    statusCounts: { [key: string]: number };
    faseCounts: { [key: string]: number };
    tempoMedioProcesso: number; // em dias
    tempoMedioPorEtapa: { name: string, dias: number }[];
    taxaConversaoFinal: number;
    funilData: { name: string, value: number }[];
  };
  provas: {
    nome: string;
    versao: string;
    totalParticipantes: number;
    mediaNotas: number;
    taxaAprovacao: number;
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
  const [selectedVagaId, setSelectedVagaId] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchVagas = async () => {
      try {
        setLoading(true);
        // Listar todas as vagas para permitir a validação solicitada
        const { data, error } = await supabase
          .from('vagas')
          .select('*, candidaturas(count)');

        if (error) throw error;
        setVagas(data || []);
      } catch (err) {
        console.error('Erro ao buscar vagas:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchVagas();
  }, []);

  const generateReport = async () => {
    if (!selectedVagaId) return;
    
    const selectedVaga = vagas.find(v => v.id === selectedVagaId);
    const isEncerrada = selectedVaga?.status?.toUpperCase() === 'ENCERRADA' || (selectedVaga?.quantidade_contratada || 0) >= 1;

    if (!isEncerrada) {
      setError('Relatório disponível apenas para vagas encerradas');
      return;
    }

    setGenerating(true);
    setError('');
    setReportData(null);

    try {
      // 1. Buscar detalhes da vaga
      const { data: vaga, error: vagaError } = await supabase
        .from('vagas')
        .select('*, provas(*)')
        .eq('id', selectedVagaId)
        .single();

      if (vagaError) throw vagaError;

      // 2. Buscar candidaturas e eventos
      const { data: candidaturas, error: candError } = await supabase
        .from('candidaturas')
        .select('*')
        .eq('vaga_id', selectedVagaId);

      if (candError) throw candError;

      if (!candidaturas || candidaturas.length === 0) {
        setError('Nenhuma candidatura encontrada para esta vaga.');
        setGenerating(false);
        return;
      }

      const { data: eventos, error: eventosError } = await supabase
        .from('candidatura_eventos')
        .select('*')
        .in('candidatura_id', candidaturas.map(c => c.id))
        .order('created_at', { ascending: true });

      if (eventosError) throw eventosError;

      // 3. Processar Estatísticas
      const statusCounts: { [key: string]: number } = {};
      const faseCounts: { [key: string]: number } = {};
      let totalNotas = 0;
      let aprovadosTeste = 0;
      let totalComTeste = 0;
      let totalContratados = 0;

      candidaturas.forEach(c => {
        const status = (c.status || 'EM_PROCESSO').toUpperCase();
        statusCounts[status] = (statusCounts[status] || 0) + 1;
        
        const fase = c.fase || 'Triagem';
        faseCounts[fase] = (faseCounts[fase] || 0) + 1;

        if (c.nota_teste !== null && c.nota_teste !== undefined) {
          totalNotas += Number(c.nota_teste);
          totalComTeste++;
          if (c.aprovacao_teste === 'Aprovado') aprovadosTeste++;
        }

        if (status === 'APROVADO' || c.fase === 'Contratado') {
          totalContratados++;
        }
      });

      // Funil de Vendas (Recrutamento)
      const stages = ['Triagem', 'Prova', 'Entrevista RH', 'Entrevista Gestor', 'Proposta', 'Contratado'];
      const funilData = stages.map(stage => {
        // Contar quantos passaram por essa fase (usando o histórico se disponível, ou a fase atual se for posterior)
        const count = candidaturas.filter(c => {
          const candEvents = (eventos || []).filter(e => e.candidatura_id === c.id);
          const passouPelaFase = candEvents.some((e: any) => e.descricao.includes(stage) || e.tipo === stage);
          const estaNaFaseOuPosterior = stages.indexOf(c.fase) >= stages.indexOf(stage);
          return passouPelaFase || estaNaFaseOuPosterior;
        }).length;
        return { name: stage, value: count };
      });

      // Tempo Médio por Etapa (Estimativa baseada no histórico)
      const tempoEtapas: { [key: string]: number[] } = {};
      candidaturas.forEach(c => {
        const candEvents = (eventos || []).filter(e => e.candidatura_id === c.id);
        if (candEvents.length > 1) {
          for (let i = 0; i < candEvents.length - 1; i++) {
            const inicio = new Date(candEvents[i].created_at).getTime();
            const fim = new Date(candEvents[i+1].created_at).getTime();
            const dias = (fim - inicio) / (1000 * 60 * 60 * 24);
            const fase = candEvents[i].tipo === 'FASE' ? (candEvents[i].descricao.match(/fase: (.*?)(?: \(|$)/)?.[1] || 'Triagem') : candEvents[i].tipo;
            if (!tempoEtapas[fase]) tempoEtapas[fase] = [];
            tempoEtapas[fase].push(dias);
          }
        }
      });

      const tempoMedioPorEtapa = Object.entries(tempoEtapas).map(([name, values]) => ({
        name,
        dias: Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(1))
      }));

      // Tempo Total do Processo
      const dataAbertura = new Date(vaga.criado_em).getTime();
      const dataEncerramento = vaga.encerrado_em ? new Date(vaga.encerrado_em).getTime() : new Date(vaga.updated_at).getTime();
      const tempoTotalVaga = (dataEncerramento - dataAbertura) / (1000 * 60 * 60 * 24);

      // Provas
      const provaInfo = vaga.provas ? {
        nome: vaga.provas.nome || 'Prova Técnica',
        versao: vaga.provas.versao || '1.0',
        totalParticipantes: totalComTeste,
        mediaNotas: totalComTeste > 0 ? Number((totalNotas / totalComTeste).toFixed(1)) : 0,
        taxaAprovacao: totalComTeste > 0 ? Number(((aprovadosTeste / totalComTeste) * 100).toFixed(1)) : 0
      } : null;

      // Análise Inteligente
      const pontosFortes = [];
      const gargalos = [];
      const sugestoes = [];

      if (provaInfo && provaInfo.taxaAprovacao > 70) {
        pontosFortes.push('Alta taxa de aprovação na prova técnica, indicando boa triagem inicial.');
      }
      
      const etapaLenta = [...tempoMedioPorEtapa].sort((a, b) => b.dias - a.dias)[0];
      if (etapaLenta && etapaLenta.dias > 5) {
        gargalos.push(`A etapa "${etapaLenta.name}" está levando em média ${etapaLenta.dias} dias, o que é acima do esperado.`);
        sugestoes.push(`Revisar o processo de agendamento e feedback na etapa "${etapaLenta.name}" para reduzir o lead time.`);
      }

      if (totalContratados === 0 && (vaga.status === 'Encerrada' || vaga.status === 'ENCERRADA')) {
        gargalos.push('Vaga encerrada sem contratações efetivadas.');
        sugestoes.push('Analisar se os requisitos da vaga estão condizentes com o mercado ou se houve falha na atração de talentos.');
      }

      if (candidaturas.length > 50 && totalContratados > 0) {
        pontosFortes.push('Grande volume de candidatos atraídos, demonstrando força da marca empregadora.');
      }

      setReportData({
        vaga,
        stats: {
          totalCandidatos: candidaturas.length,
          statusCounts,
          faseCounts,
          tempoMedioProcesso: Number(tempoTotalVaga.toFixed(1)),
          tempoMedioPorEtapa,
          taxaConversaoFinal: Number(((totalContratados / candidaturas.length) * 100).toFixed(1)),
          funilData
        },
        provas: provaInfo,
        analise: {
          pontosFortes: pontosFortes.length > 0 ? pontosFortes : ['Processo dentro da normalidade.'],
          gargalos: gargalos.length > 0 ? gargalos : ['Nenhum gargalo crítico identificado.'],
          sugestoes: sugestoes.length > 0 ? sugestoes : ['Manter o acompanhamento regular das etapas.']
        }
      });

      await logAudit('Gerar Relatório', 'Relatórios', `Gerou relatório para a vaga: ${vaga.titulo}`);

    } catch (err: any) {
      console.error('Erro ao gerar relatório:', err);
      setError('Ocorreu um erro ao processar os dados do relatório.');
    } finally {
      setGenerating(false);
    }
  };

  if (profile?.perfil !== 'RH' && profile?.perfil !== 'Admin') {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center">
        <AlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Acesso Negado</h2>
        <p className="text-slate-600">Esta seção é exclusiva para usuários com perfil de RH.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Relatórios Estratégicos</h2>
          <p className="text-slate-500">Análise detalhada e KPIs do processo seletivo</p>
        </div>
      </div>

      {/* Seleção de Vaga */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex flex-col md:flex-row items-end gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Selecione uma Vaga</label>
            <div className="relative">
              <Briefcase className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <select 
                value={selectedVagaId}
                onChange={(e) => setSelectedVagaId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
              >
                <option value="">Selecione uma vaga...</option>
                {vagas.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.codigo_vaga ? `[${v.codigo_vaga}] ` : ''}{v.titulo} ({v.departamento})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button 
            onClick={generateReport}
            disabled={!selectedVagaId || generating}
            className="bg-primary text-white px-8 py-2.5 rounded-xl font-bold hover:bg-accent transition-all flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20"
          >
            {generating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Activity className="w-5 h-5" />
                Gerar Relatório
              </>
            )}
          </button>
        </div>
        {error && <p className="mt-4 text-sm text-red-500 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {error}</p>}
      </div>

      {reportData && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header do Relatório */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="md:col-span-2 bg-gradient-to-br from-primary to-accent p-6 rounded-2xl text-white shadow-xl">
              <div className="flex items-start justify-between mb-4">
                <div className="p-2 bg-white/20 rounded-lg">
                  <Award className="w-6 h-6" />
                </div>
                <span className="text-xs font-bold uppercase tracking-wider bg-white/20 px-2 py-1 rounded">Resumo da Vaga</span>
              </div>
              <h3 className="text-2xl font-bold mb-1">{reportData.vaga.titulo}</h3>
              <p className="text-white/80 text-sm mb-4">{reportData.vaga.departamento} • {reportData.vaga.codigo_vaga}</p>
              <div className="grid grid-cols-2 gap-4 pt-4 border-t border-white/20">
                <div>
                  <p className="text-xs text-white/60">Abertura</p>
                  <p className="font-bold">{new Date(reportData.vaga.criado_em).toLocaleDateString('pt-BR')}</p>
                </div>
                <div>
                  <p className="text-xs text-white/60">Encerramento</p>
                  <p className="font-bold">{reportData.vaga.encerrado_em ? new Date(reportData.vaga.encerrado_em).toLocaleDateString('pt-BR') : 'N/A'}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">Tempo Total</span>
                <Clock className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h4 className="text-3xl font-bold text-slate-900">{reportData.stats.tempoMedioProcesso} dias</h4>
                <p className="text-xs text-slate-500 mt-1">Duração total do processo</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Meta: 30 dias</span>
                  <span className={reportData.stats.tempoMedioProcesso <= 30 ? 'text-emerald-500' : 'text-red-500'}>
                    {reportData.stats.tempoMedioProcesso <= 30 ? 'Dentro da meta' : 'Acima da meta'}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 flex flex-col justify-between">
              <div className="flex items-center justify-between mb-2">
                <span className="text-slate-500 text-sm font-medium">Taxa de Conversão</span>
                <Target className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h4 className="text-3xl font-bold text-slate-900">{reportData.stats.taxaConversaoFinal}%</h4>
                <p className="text-xs text-slate-500 mt-1">Candidatos contratados / inscritos</p>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-100">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-500">Total Candidatos: {reportData.stats.totalCandidatos}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Gráficos e Funil */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Funil de Recrutamento */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Funil de Recrutamento
              </h3>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <FunnelChart>
                    <Tooltip />
                    <Funnel
                      data={reportData.stats.funilData}
                      dataKey="value"
                      nameKey="name"
                      labelLine={true}
                    >
                      <LabelList position="right" fill="#64748b" stroke="none" dataKey="name" />
                      {reportData.stats.funilData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Funnel>
                  </FunnelChart>
                </ResponsiveContainer>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-4">
                {reportData.stats.funilData.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100">
                    <span className="text-xs font-medium text-slate-600">{item.name}</span>
                    <span className="text-sm font-bold text-slate-900">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tempo por Etapa */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                Tempo Médio por Etapa (Dias)
              </h3>
              <div style={{ width: '100%', height: 350 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={reportData.stats.tempoMedioPorEtapa} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="dias" fill="#6366f1" radius={[0, 4, 4, 0]}>
                      <LabelList dataKey="dias" position="right" style={{ fontSize: '12px', fontWeight: 'bold' }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p className="text-xs text-slate-500 mt-4 italic">
                * Calculado com base na diferença de tempo entre as movimentações de fase no histórico.
              </p>
            </div>
          </div>

          {/* Provas e Avaliações */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Card de Prova */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 lg:col-span-1">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-primary" />
                Desempenho em Provas
              </h3>
              {reportData.provas ? (
                <div className="space-y-6">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <p className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">Prova Aplicada</p>
                    <p className="text-sm font-bold text-slate-900">{reportData.provas.nome}</p>
                    <p className="text-[10px] text-slate-400">Versão: {reportData.provas.versao}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-emerald-50 rounded-xl border border-emerald-100">
                      <p className="text-[10px] text-emerald-600 font-bold uppercase mb-1">Média Notas</p>
                      <p className="text-2xl font-black text-emerald-700">{reportData.provas.mediaNotas}</p>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-xl border border-blue-100">
                      <p className="text-[10px] text-blue-600 font-bold uppercase mb-1">Aprovação</p>
                      <p className="text-2xl font-black text-blue-700">{reportData.provas.taxaAprovacao}%</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm pt-4 border-t border-slate-100">
                    <span className="text-slate-500">Total Participantes</span>
                    <span className="font-bold text-slate-900">{reportData.provas.totalParticipantes}</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-slate-400">
                  <Info className="w-12 h-12 mb-2 opacity-20" />
                  <p className="text-sm italic">Esta vaga não exigiu prova técnica.</p>
                </div>
              )}
            </div>

            {/* Análise Inteligente */}
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 lg:col-span-2">
              <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center gap-2">
                <Zap className="w-5 h-5 text-amber-500" />
                Análise Inteligente (Especialista RH)
              </h3>
              
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-emerald-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Pontos Fortes
                  </h4>
                  <ul className="space-y-2">
                    {reportData.analise.pontosFortes.map((item, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-red-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" /> Gargalos Identificados
                  </h4>
                  <ul className="space-y-2">
                    {reportData.analise.gargalos.map((item, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <h4 className="text-sm font-bold text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4" /> Sugestões de Melhoria
                  </h4>
                  <ul className="space-y-2">
                    {reportData.analise.sugestoes.map((item, i) => (
                      <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                        <ChevronRight className="w-4 h-4 text-primary shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Botão de Exportação */}
          <div className="flex justify-end">
            <button 
              onClick={() => window.print()}
              className="flex items-center gap-2 px-6 py-3 bg-slate-900 text-white font-bold rounded-xl hover:bg-slate-800 transition-all shadow-lg"
            >
              <Download className="w-5 h-5" />
              Exportar PDF / Imprimir
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
