import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Users, Shield, BarChart, Plus, Search, Activity, Ban, Snowflake, Unlock, CheckCircle2, Database, Eye, EyeOff, Filter, XCircle, ArrowUpDown, ArrowUp, ArrowDown, Briefcase, FileText, UserPlus, Repeat, Clock, AlertCircle, Check, Trash2, RefreshCw } from 'lucide-react';
import { seedDatabase } from '../lib/seed';
import { supabase, supabaseAdmin } from '../lib/supabase';
import { createClient } from '@supabase/supabase-js';
import { BarChart as ReBarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { TransferOwnerModal } from '../components/TransferOwnerModal';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../lib/audit';

const PRIMARY_COLORS = ['#0ea5e9', '#38bdf8', '#7dd3fc', '#bae6fd', '#e0f2fe'];

export function AdminDashboard() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState({ show: false, text: '', type: 'success' });

  const [recentLogs, setRecentLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  const [metrics, setMetrics] = useState({
    totalTalentos: 0,
    vagasAtivas: 0,
    candidaturasMes: 0,
    usersTotais: 0,
    novosCandidatos24h: 0,
    loading: true
  });

  const [cargaTrabalhoState, setCargaTrabalhoState] = useState<any[]>([]);
  const [isCheckingIntegrity, setIsCheckingIntegrity] = useState(false);
  const [integrityResults, setIntegrityResults] = useState<{
    total: number;
    missingVaga: number;
    missingCandidato: number;
    fixed: number;
    deleted: number;
    show: boolean;
  }>({ total: 0, missingVaga: 0, missingCandidato: 0, fixed: 0, deleted: 0, show: false });

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const fetchTotalTalentos = async () => {
          const { count, error } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('perfil', 'Candidato');
          if (error) throw error;
          return count || 0;
        };

        const fetchVagasAtivas = async () => {
          const { count, error } = await supabase
            .from('vagas')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'Aberta');
          if (error) throw error;
          return count || 0;
        };

        const fetchCandidaturasMes = async () => {
          const trintaDiasAtras = new Date();
          trintaDiasAtras.setDate(trintaDiasAtras.getDate() - 30);
          const { count, error } = await supabase
            .from('candidaturas')
            .select('*', { count: 'exact', head: true })
            .gte('data_candidatura', trintaDiasAtras.toISOString());
          if (error) throw error;
          return count || 0;
        };

        const fetchUsuariosTotais = async () => {
          const { count, error } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .in('perfil', ['RH', 'Candidato']);
          if (error) throw error;
          return count || 0;
        };

        const fetchNovosCandidatos24h = async () => {
          const vinteQuatroHorasAtras = new Date();
          vinteQuatroHorasAtras.setHours(vinteQuatroHorasAtras.getHours() - 24);
          const { count, error } = await supabase
            .from('users')
            .select('*', { count: 'exact', head: true })
            .eq('perfil', 'Candidato')
            .gte('created_at', vinteQuatroHorasAtras.toISOString());
          if (error) throw error;
          return count || 0;
        };

        const fetchCargaTrabalho = async () => {
          const [vagasRes, usersRes] = await Promise.all([
            supabase.from('vagas').select('owner_nome').eq('status', 'Aberta'),
            supabase.from('users').select('nome').eq('perfil', 'RH').eq('status', 'Ativo')
          ]);

          if (vagasRes.error) throw vagasRes.error;
          if (usersRes.error) throw usersRes.error;

          const rhUsers = usersRes.data || [];
          const cargaTrabalhoMap: { [key: string]: number } = {};
          
          rhUsers.forEach(user => {
            cargaTrabalhoMap[user.nome] = 0;
          });

          (vagasRes.data || []).forEach((v: any) => {
            const nomeResponsavel = v.owner_nome || v.owner?.nome;
            if (nomeResponsavel && cargaTrabalhoMap[nomeResponsavel] !== undefined) {
              cargaTrabalhoMap[nomeResponsavel] += 1;
            }
          });

          return Object.keys(cargaTrabalhoMap)
            .map(key => ({ name: key, vagas: cargaTrabalhoMap[key] }))
            .sort((a, b) => b.vagas - a.vagas);
        };

        const [totalTalentos, vagasAtivas, candidaturasMes, usersTotais, novosCandidatos24h, cargaTrabalho] = await Promise.all([
          fetchTotalTalentos(),
          fetchVagasAtivas(),
          fetchCandidaturasMes(),
          fetchUsuariosTotais(),
          fetchNovosCandidatos24h(),
          fetchCargaTrabalho()
        ]);

        setMetrics({
          totalTalentos,
          vagasAtivas,
          candidaturasMes,
          usersTotais,
          novosCandidatos24h,
          loading: false
        });
        setCargaTrabalhoState(cargaTrabalho);
      } catch (error) {
        console.error("Erro ao buscar métricas:", error);
        setMetrics(prev => ({ ...prev, loading: false }));
      }
    };

    fetchMetrics();
  }, []);

  useEffect(() => {
    const fetchRecentLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('logs')
          .select('*')
          .order('data', { ascending: false })
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

  const handleSeed = async () => {
    setIsSeeding(true);
    try {
      const novosCandidatos = await seedDatabase();
      console.log('--- CANDIDATOS CRIADOS ---');
      console.table(novosCandidatos);
      setSeedMessage({ show: true, text: 'Banco de dados populado com sucesso! Verifique o console para os logins.', type: 'success' });
      
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .order('data', { ascending: false })
        .limit(5);
      if (!error) setRecentLogs(data || []);
    } catch (error) {
      console.error('Erro ao popular banco de dados:', error);
      setSeedMessage({ show: true, text: 'Erro ao popular banco de dados. Verifique o console.', type: 'error' });
    } finally {
      setIsSeeding(false);
      setTimeout(() => setSeedMessage({ show: false, text: '', type: 'success' }), 5000);
    }
  };

  const handleIntegrityCheck = async () => {
    setIsCheckingIntegrity(true);
    try {
      // 1. Buscar todas as mensagens
      const { data: mensagens, error: msgError } = await supabaseAdmin
        .from('mensagens_chat')
        .select('*');
      
      if (msgError) throw msgError;

      const total = mensagens?.length || 0;
      let missingVaga = 0;
      let missingCandidato = 0;
      let fixed = 0;
      let deleted = 0;

      const toDelete: string[] = [];
      const toUpdate: any[] = [];

      // 2. Buscar candidaturas para tentar recuperar IDs
      const { data: candidaturas } = await supabaseAdmin.from('candidaturas').select('id, candidato_id, vaga_id');

      for (const msg of (mensagens || [])) {
        let needsFix = false;
        let currentVagaId = msg.vaga_id;
        let currentCandidatoId = msg.candidato_id;

        if (!currentVagaId) missingVaga++;
        if (!currentCandidatoId) missingCandidato++;

        if (!currentVagaId || !currentCandidatoId) {
          // Tentar encontrar via candidatura se tiver pelo menos um ID
          if (currentCandidatoId && !currentVagaId) {
            const candVagas = candidaturas?.filter(c => c.candidato_id === currentCandidatoId) || [];
            if (candVagas.length === 1) {
              currentVagaId = candVagas[0].vaga_id;
              needsFix = true;
            }
          } else if (currentVagaId && !currentCandidatoId) {
            const vagaCands = candidaturas?.filter(c => c.vaga_id === currentVagaId) || [];
            if (vagaCands.length === 1) {
              currentCandidatoId = vagaCands[0].candidato_id;
              needsFix = true;
            }
          }

          if (needsFix && currentVagaId && currentCandidatoId) {
            toUpdate.push({ id: msg.id, vaga_id: currentVagaId, candidato_id: currentCandidatoId });
            fixed++;
          } else {
            // Se não conseguiu corrigir e falta um ID essencial, marcar para exclusão
            toDelete.push(msg.id);
            deleted++;
          }
        }
      }

      // 3. Executar correções
      if (toUpdate.length > 0) {
        for (const up of toUpdate) {
          await supabaseAdmin.from('mensagens_chat').update({
            vaga_id: up.vaga_id,
            candidato_id: up.candidato_id
          }).eq('id', up.id);
        }
      }

      // 4. Executar exclusões
      if (toDelete.length > 0) {
        await supabaseAdmin.from('mensagens_chat').delete().in('id', toDelete);
      }

      setIntegrityResults({
        total,
        missingVaga,
        missingCandidato,
        fixed,
        deleted,
        show: true
      });

      await logAudit('Verificação de Integridade', 'Admin', `Mensagens verificadas: ${total}. Corrigidas: ${fixed}. Excluídas: ${deleted}.`);
    } catch (error) {
      console.error('Erro na verificação de integridade:', error);
      alert('Erro ao verificar integridade das mensagens.');
    } finally {
      setIsCheckingIntegrity(false);
    }
  };

  const formatTimeAgo = (dateStr: any) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Agora mesmo';
    if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} minutos`;
    if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} horas`;
    return date.toLocaleDateString('pt-BR');
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">Dashboard Administrativo</h1>
          {seedMessage.show && (
            <div className={`px-4 py-2 rounded-lg text-sm font-medium ${seedMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
              {seedMessage.text}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleIntegrityCheck}
            disabled={isCheckingIntegrity}
            className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Shield className="w-5 h-5" />
            {isCheckingIntegrity ? 'Verificando...' : 'Corrigir Mensagens (Integridade)'}
          </button>
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className="flex items-center gap-2 bg-slate-800 hover:bg-slate-900 text-white px-4 py-2 rounded-lg font-medium transition-colors disabled:opacity-50"
          >
            <Database className="w-5 h-5" />
            {isSeeding ? 'Populando...' : 'Popular Banco de Dados (Seed)'}
          </button>
        </div>
      </div>

      {/* Resultado da Integridade */}
      {integrityResults.show && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-amber-200 flex items-start gap-4">
          <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-start">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Resultado da Verificação de Integridade</h3>
                <p className="text-sm text-slate-500">A verificação de mensagens do chat foi concluída.</p>
              </div>
              <button onClick={() => setIntegrityResults(prev => ({ ...prev, show: false }))} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4">
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Total Analisado</p>
                <p className="text-xl font-bold text-slate-900">{integrityResults.total}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Sem Vaga ID</p>
                <p className="text-xl font-bold text-amber-600">{integrityResults.missingVaga}</p>
              </div>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                <p className="text-[10px] text-slate-500 uppercase font-bold">Sem Candidato ID</p>
                <p className="text-xl font-bold text-amber-600">{integrityResults.missingCandidato}</p>
              </div>
              <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                <p className="text-[10px] text-emerald-600 uppercase font-bold">Corrigidas</p>
                <p className="text-xl font-bold text-emerald-700">{integrityResults.fixed}</p>
              </div>
              <div className="p-3 bg-rose-50 rounded-lg border border-rose-100">
                <p className="text-[10px] text-rose-600 uppercase font-bold">Excluídas (Órfãs)</p>
                <p className="text-xl font-bold text-rose-700">{integrityResults.deleted}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TOPO: KPIs Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 rounded-lg text-blue-600 shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Total de Talentos</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {metrics.loading ? '...' : metrics.totalTalentos}
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
                {metrics.loading ? '...' : metrics.vagasAtivas}
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
              <p className="text-sm font-medium text-slate-500">Candidaturas do Mês</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {metrics.loading ? '...' : metrics.candidaturasMes}
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
              <p className="text-sm font-medium text-slate-500">Total de Usuários</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {metrics.loading ? '...' : metrics.usersTotais}
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
              <p className="text-sm font-medium text-slate-500">Novos Candidatos (24h)</p>
              <h3 className="text-2xl font-bold text-slate-900">
                {metrics.loading ? '...' : metrics.novosCandidatos24h}
              </h3>
            </div>
          </div>
        </div>
      </div>

      {/* MEIO: Indicadores Secundários */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary shrink-0">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Usuários RH Ativos</p>
              <h3 className="text-2xl font-bold text-slate-900">24</h3>
            </div>
          </div>
          <Link to="/admin/users" className="text-sm text-primary font-medium hover:underline mt-auto">Gerenciar usuários</Link>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600 shrink-0">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Acessos Hoje</p>
              <h3 className="text-2xl font-bold text-slate-900">1,245</h3>
            </div>
          </div>
          <Link to="/admin/auditoria" className="text-sm text-primary font-medium hover:underline mt-auto">Ver logs de auditoria</Link>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-between h-full">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-100 rounded-lg text-amber-600 shrink-0">
              <BarChart className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Vagas Preenchidas (Mês)</p>
              <h3 className="text-2xl font-bold text-slate-900">18</h3>
            </div>
          </div>
        </div>
      </div>

      {/* BASE: Gráficos e Análises */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Carga de Trabalho por Recrutador (Vagas Abertas)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <ReBarChart data={cargaTrabalhoState} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="vagas" radius={[4, 4, 0, 0]} barSize={40}>
                  {cargaTrabalhoState.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PRIMARY_COLORS[index % PRIMARY_COLORS.length]} />
                  ))}
                  <LabelList dataKey="vagas" position="top" fill="#64748b" fontSize={12} />
                </Bar>
              </ReBarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 border-b border-slate-200 flex justify-between items-center">
            <h2 className="text-lg font-bold text-slate-900">Últimas Atividades do Sistema</h2>
          </div>
          <div className="divide-y divide-slate-200 h-64 overflow-y-auto">
            {loadingLogs ? (
              <div className="p-6 text-center text-slate-500">Carregando atividades...</div>
            ) : recentLogs.length === 0 ? (
              <div className="p-6 text-center text-slate-500">Nenhuma atividade registrada.</div>
            ) : (
              recentLogs.map((log) => (
                <div key={log.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500">
                      <Shield className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-medium text-slate-900">{log.acao}</h4>
                      <p className="text-xs text-slate-500">Usuário: {log.usuarioEmail || log.usuarioId}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-slate-400">{formatTimeAgo(log.data)}</span>
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
  const [transferModal, setTransferModal] = useState<{ isOpen: boolean, vaga: any }>({ isOpen: false, vaga: null });
  const [expiredTransfers, setExpiredTransfers] = useState<any[]>([]);
  const [isProcessingReturn, setIsProcessingReturn] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchVagas = async () => {
      try {
        const { data, error } = await supabase
          .from('vagas')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        const vagasData = data || [];
        setVagas(vagasData);
        checkExpiredTransfers(vagasData);
      } catch (error) {
        console.error('Erro ao buscar vagas:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVagas();

    // Realtime subscription
    const channel = supabase
      .channel('vagas_admin_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'vagas' }, () => {
        fetchVagas();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const checkExpiredTransfers = (vagasList: any[]) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expired = vagasList.filter(v => {
      if (!v.transferencia_ativa || !v.transferencia_temporaria) return false;
      if (!v.transferencia_temporaria.auto_retorno) return false;
      
      const dataRetorno = new Date(v.transferencia_temporaria.data_retorno);
      dataRetorno.setHours(0, 0, 0, 0);
      
      return dataRetorno <= today;
    });

    setExpiredTransfers(expired);
  };

  const handleAutoReturn = async (vaga: any) => {
    try {
      setIsProcessingReturn(true);
      
      const { error: updateError } = await supabase
        .from('vagas')
        .update({
          owner_id: vaga.transferencia_temporaria.original_owner_id || null,
          owner_nome: vaga.transferencia_temporaria.original_owner_nome || 'Sem proprietário',
          transferencia_ativa: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', vaga.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('transferencias')
        .insert({
          vaga_id: vaga.id,
          tipo: 'Retorno Automático',
          data_execucao: new Date().toISOString(),
          novo_owner_id: vaga.transferencia_temporaria.original_owner_id || null,
          novo_owner_nome: vaga.transferencia_temporaria.original_owner_nome || 'Sem proprietário',
          prev_owner_id: vaga.owner_id || null,
          prev_owner_nome: vaga.owner_nome || 'Sem proprietário',
          justificativa: 'Retorno automático de propriedade após o término do período de ausência temporária.',
          executado_por: 'Sistema (Auto-retorno)',
          executado_por_id: 'system'
        });

      if (logError) throw logError;

      await logAudit(
        'Retorno Automático de Proprietário',
        'Gestão de Transferências',
        `Retorno automático da vaga ${vaga.titulo} para ${vaga.transferencia_temporaria.original_owner_nome}`
      );

      alert(`Vaga "${vaga.titulo}" retornada com sucesso para ${vaga.transferencia_temporaria.original_owner_nome}.`);
    } catch (error) {
      console.error('Erro ao processar retorno automático:', error);
      alert('Erro ao processar retorno automático.');
    } finally {
      setIsProcessingReturn(false);
    }
  };

  const filteredVagas = vagas.filter(v => 
    v.titulo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (v.ownerNome && v.ownerNome.toLowerCase().includes(searchTerm.toLowerCase())) ||
    (v.codigo_vaga && v.codigo_vaga.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Transferências de Vagas</h1>
          <p className="text-slate-500">Transfira a propriedade de vagas entre recrutadores de forma temporária ou definitiva.</p>
        </div>
      </div>

      {/* Alertas de Transferências Expiradas */}
      {expiredTransfers.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4 shadow-sm">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="text-sm font-bold text-amber-900">Transferências Temporárias Vencidas</h4>
            <p className="text-xs text-amber-700 mt-1">
              {expiredTransfers.length} vaga(s) possuem o prazo de retorno do proprietário original expirado.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {expiredTransfers.map(vaga => (
                <div key={vaga.id} className="flex items-center gap-2 bg-white border border-amber-200 px-3 py-1.5 rounded-lg text-xs shadow-sm">
                  <span className="font-medium text-slate-700">{vaga.titulo}</span>
                  <span className="text-slate-400">|</span>
                  <span className="text-slate-600">Retorno: {vaga.transferenciaTemporaria.originalOwnerNome}</span>
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
                  <td colSpan={4} className="px-6 py-4 text-center">Carregando vagas...</td>
                </tr>
              ) : filteredVagas.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-4 text-center">Nenhuma vaga encontrada.</td>
                </tr>
              ) : (
                filteredVagas.map((vaga) => (
                  <tr key={vaga.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-900">{vaga.titulo}</span>
                        <span className="text-[10px] text-slate-400 font-mono">{vaga.codigo_vaga || '-'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-600">
                          {(vaga.ownerNome || 'S').charAt(0)}
                        </div>
                        <span className="text-xs">{vaga.ownerNome || 'Sem proprietário'}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {vaga.transferencia_ativa ? (
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700 w-fit">
                            Temporária
                          </span>
                          <span className="text-[10px] text-slate-500">
                            Retorno: {new Date(vaga.transferencia_temporaria?.data_retorno).toLocaleDateString('pt-BR')}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic">Nenhuma transferência ativa</span>
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
          onSuccess={() => {}}
        />
      )}
    </div>
  );
}

export function AdminGestaoUsuarios() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('Todos');
  
  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isInactivateModalOpen, setIsInactivateModalOpen] = useState(false);
  
  // Selected User for Actions
  const [selectedUser, setSelectedUser] = useState<any>(null);
  
  // Form States
  const [formData, setFormData] = useState({ nome: '', email: '', login: '', senha: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [showSenha, setShowSenha] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('perfil', 'RH')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Erro ao buscar usuários:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      // 1. Check if login exists
      const { data: existing } = await supabase
        .from('users')
        .select('id')
        .eq('login_lower', formData.login.toLowerCase())
        .maybeSingle();

      if (existing) throw new Error('Este login já está em uso.');

      // 2. Create in Auth (Admin)
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: formData.email,
        password: formData.senha,
        email_confirm: true,
        user_metadata: {
          nome: formData.nome,
          perfil: 'RH'
        }
      });

      if (authError) throw authError;

      // 3. Create in users table
      const { error: dbError } = await supabase.from('users').insert({
        id: authData.user.id,
        uid: authData.user.id,
        nome: formData.nome,
        email: formData.email,
        login: formData.login,
        login_lower: formData.login.toLowerCase(),
        perfil: 'RH',
        status: 'Ativo'
      });

      if (dbError) throw dbError;

      await logAudit('Criação de Usuário', 'Admin', `Criou usuário RH: ${formData.nome} (${formData.login})`);
      
      setIsCreateModalOpen(false);
      setFormData({ nome: '', email: '', login: '', senha: '' });
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao criar usuário.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const { error: dbError } = await supabase
        .from('users')
        .update({
          nome: formData.nome,
          email: formData.email
        })
        .eq('id', selectedUser.id);

      if (dbError) throw dbError;

      // Update Auth Email if changed
      if (formData.email !== selectedUser.email) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(selectedUser.id, {
          email: formData.email
        });
        if (authError) throw authError;
      }

      await logAudit('Edição de Usuário', 'Admin', `Editou usuário RH: ${selectedUser.login}`);
      
      setIsEditModalOpen(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message || 'Erro ao editar usuário.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');

    try {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(selectedUser.id, {
        password: formData.senha
      });

      if (authError) throw authError;

      await logAudit('Reset de Senha', 'Admin', `Resetou senha do usuário RH: ${selectedUser.login}`);
      
      setIsResetModalOpen(false);
      setFormData(prev => ({ ...prev, senha: '' }));
    } catch (err: any) {
      setError(err.message || 'Erro ao resetar senha.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (user: any, newStatus: string) => {
    try {
      const updateData: any = { status: newStatus };
      if (newStatus === 'Inativo') {
        updateData.removed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', user.id);

      if (error) throw error;

      await logAudit('Alteração de Status', 'Admin', `Alterou status de ${user.login} para ${newStatus}`);
      fetchUsers();
    } catch (err) {
      console.error('Erro ao alterar status:', err);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         u.login.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'Todos' || u.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Gestão de Usuários RH</h1>
          <p className="text-slate-500 text-sm">Gerencie os recrutadores e administradores do sistema.</p>
        </div>
        <button 
          onClick={() => {
            setFormData({ nome: '', email: '', login: '', senha: '' });
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
            onChange={e => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select 
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
        >
          <option value="Todos">Todos os Status</option>
          <option value="Ativo">Ativo</option>
          <option value="Congelado">Congelado</option>
          <option value="Inativo">Inativo</option>
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
                <th className="px-6 py-4">Remoção</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Carregando usuários...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">Nenhum usuário encontrado.</td></tr>
              ) : (
                filteredUsers.map(u => (
                  <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="font-bold text-slate-900">{u.nome}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-slate-600">{u.email}</div>
                      <div className="text-[10px] font-mono text-slate-400 uppercase">{u.login}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold uppercase ${
                        u.status === 'Ativo' ? 'bg-emerald-100 text-emerald-700' :
                        u.status === 'Congelado' ? 'bg-amber-100 text-amber-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {u.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {new Date(u.created_at).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {u.removed_at ? new Date(u.removed_at).toLocaleDateString('pt-BR') : '-'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        {u.status !== 'Inativo' && (
                          <>
                            <button 
                              onClick={() => {
                                setSelectedUser(u);
                                setFormData({ nome: u.nome, email: u.email, login: u.login, senha: '' });
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
                                setFormData(prev => ({ ...prev, senha: '' }));
                                setIsResetModalOpen(true);
                              }}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" 
                              title="Resetar Senha"
                            >
                              <Unlock className="w-4 h-4" />
                            </button>
                            {u.status === 'Ativo' ? (
                              <button 
                                onClick={() => handleStatusChange(u, 'Congelado')}
                                className="p-1.5 text-amber-600 hover:bg-amber-50 rounded-lg transition-colors" 
                                title="Congelar"
                              >
                                <Snowflake className="w-4 h-4" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => handleStatusChange(u, 'Ativo')}
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
                              title="Inativar"
                            >
                              <Ban className="w-4 h-4" />
                            </button>
                          </>
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
              <h3 className="text-lg font-bold text-slate-900">Novo Usuário RH</h3>
              <button onClick={() => setIsCreateModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleCreateUser} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome Completo</label>
                <input required type="text" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email Corporativo</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Login de Acesso</label>
                <input required type="text" value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Ex: joao.silva" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Senha Inicial</label>
                <div className="relative">
                  <input required type={showSenha ? "text" : "password"} value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none pr-10" />
                  <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="pt-4">
                <button disabled={isSaving} type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-accent transition-colors disabled:opacity-50">
                  {isSaving ? 'Criando...' : 'Criar Usuário'}
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
              <h3 className="text-lg font-bold text-slate-900">Editar Usuário</h3>
              <button onClick={() => setIsEditModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleEditUser} className="p-6 space-y-4">
              {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nome Completo</label>
                <input required type="text" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Email</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" />
              </div>
              <div className="pt-4">
                <button disabled={isSaving} type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-accent transition-colors disabled:opacity-50">
                  {isSaving ? 'Salvando...' : 'Salvar Alterações'}
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
              <h3 className="text-lg font-bold text-slate-900">Resetar Senha</h3>
              <button onClick={() => setIsResetModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
            </div>
            <form onSubmit={handleResetPassword} className="p-6 space-y-4">
              <p className="text-sm text-slate-600">Defina uma nova senha para o usuário <strong>{selectedUser?.login}</strong>.</p>
              {error && <div className="p-3 bg-red-50 text-red-700 text-xs rounded-lg border border-red-100">{error}</div>}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">Nova Senha</label>
                <div className="relative">
                  <input required type={showSenha ? "text" : "password"} value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none pr-10" />
                  <button type="button" onClick={() => setShowSenha(!showSenha)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="pt-4">
                <button disabled={isSaving} type="submit" className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold hover:bg-purple-700 transition-colors disabled:opacity-50">
                  {isSaving ? 'Resetando...' : 'Confirmar Novo Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Inativar */}
      {isInactivateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Ban className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">Inativar Usuário</h3>
            <p className="text-slate-600 mb-6">
              Você tem certeza que deseja inativar <strong>{selectedUser?.nome}</strong>? <br/>
              <span className="text-red-600 font-bold text-xs uppercase mt-2 block">Usuários inativados não podem ser reativados.</span>
            </p>
            <div className="flex gap-3">
              <button onClick={() => setIsInactivateModalOpen(false)} className="flex-1 bg-slate-100 text-slate-700 py-3 rounded-lg font-bold hover:bg-slate-200 transition-colors">Cancelar</button>
              <button onClick={() => {
                handleStatusChange(selectedUser, 'Inativo');
                setIsInactivateModalOpen(false);
              }} className="flex-1 bg-red-600 text-white py-3 rounded-lg font-bold hover:bg-red-700 transition-colors">Sim, Inativar</button>
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
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Sorting and Filtering
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const { data, error } = await supabase
          .from('logs')
          .select('*')
          .order('data', { ascending: false })
          .limit(50);
        
        if (error) throw error;
        setLogs(data || []);
      } catch (error) {
        console.error("Erro ao buscar logs:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  const formatData = (dateStr: any) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('pt-BR');
  };

  const formatHora = (dateStr: any) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('pt-BR');
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const handleColumnFilterChange = (key: string, value: string) => {
    setColumnFilters(prev => ({ ...prev, [key]: value }));
  };

  const getSortValue = (obj: any, key: string) => {
    if (key === 'data' || key === 'hora') {
      if (!obj.data) return 0;
      return new Date(obj.data).getTime();
    }
    if (key === 'usuario') {
      return (obj.usuario_email || obj.usuario_id || '').toLowerCase();
    }
    return obj[key] ? String(obj[key]).toLowerCase() : '';
  };

  const filteredLogs = logs.filter(log => {
    const matchesColumnFilters = Object.entries(columnFilters).every(([key, value]) => {
      if (!value) return true;
      let logValue = '';
      if (key === 'data') {
        logValue = formatData(log.data);
      } else if (key === 'hora') {
        logValue = formatHora(log.data);
      } else if (key === 'usuario') {
        logValue = (log.usuario_email || log.usuario_id || '').toLowerCase();
      } else {
        logValue = String(log[key] || '').toLowerCase();
      }
      return logValue.includes(String(value).toLowerCase());
    });
    return matchesColumnFilters;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    const aValue = getSortValue(a, key);
    const bValue = getSortValue(b, key);
    
    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const renderFilterInput = (key: string) => {
    return (
      <div className="relative flex items-center mt-1">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            setActiveFilterColumn(activeFilterColumn === key ? null : key);
          }}
          className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? 'text-primary' : 'text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}
        >
          <Filter className="w-3.5 h-3.5" />
        </button>
        {activeFilterColumn === key && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-slate-200 shadow-lg rounded-lg p-2 z-10 w-48" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-700">Filtrar</span>
              <button onClick={() => setActiveFilterColumn(null)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
            <input
              type="text"
              placeholder="Digite para filtrar..."
              value={columnFilters[key] || ''}
              onChange={(e) => handleColumnFilterChange(key, e.target.value)}
              className="w-full px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-primary"
              autoFocus
            />
          </div>
        )}
      </div>
    );
  };

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortConfig.direction === 'asc' ? <ArrowUp className="w-3.5 h-3.5 text-primary" /> : <ArrowDown className="w-3.5 h-3.5 text-primary" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-slate-900">Trilha de Auditoria (Audit Trail)</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">
                  <div className="flex items-center gap-2 cursor-pointer group" onClick={() => handleSort('data')}>
                    Data {renderSortIcon('data')}
                  </div>
                  {renderFilterInput('data')}
                </th>
                <th className="px-6 py-4">
                  <div className="flex items-center gap-2 cursor-pointer group" onClick={() => handleSort('hora')}>
                    Hora {renderSortIcon('hora')}
                  </div>
                  {renderFilterInput('hora')}
                </th>
                <th className="px-6 py-4">
                  <div className="flex items-center gap-2 cursor-pointer group" onClick={() => handleSort('usuario')}>
                    Usuário {renderSortIcon('usuario')}
                  </div>
                  {renderFilterInput('usuario')}
                </th>
                <th className="px-6 py-4">Ação</th>
                <th className="px-6 py-4">
                  <div className="flex items-center gap-2 cursor-pointer group" onClick={() => handleSort('modulo')}>
                    Módulo {renderSortIcon('modulo')}
                  </div>
                  {renderFilterInput('modulo')}
                </th>
                <th className="px-6 py-4">Detalhes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">Carregando logs...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">Nenhum log encontrado.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">{formatData(log.data)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-slate-500">{formatHora(log.data)}</td>
                    <td className="px-6 py-4 font-medium text-slate-900">{log.usuario_email || log.usuario_id}</td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-medium">
                        {log.acao}
                      </span>
                    </td>
                    <td className="px-6 py-4">{log.modulo}</td>
                    <td className="px-6 py-4 text-slate-500">{log.detalhes}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
