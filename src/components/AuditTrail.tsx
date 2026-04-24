import React, { useState, useEffect, useCallback } from 'react';
import { 
  Download, 
  Search, 
  ShieldAlert, 
  SearchIcon,
  Lock,
  Activity,
  ChevronRight,
  ChevronLeft,
  X,
  AlertTriangle,
  RefreshCcw
} from 'lucide-react';
import { supabase } from '../lib/supabase';

/**
 * Interface AuditLog - Protocolo v5.0 (Real-Time + RJ Sync)
 */
interface AuditLog {
  id: string;
  created_at: string;
  acao: string;
  modulo: string;
  detalhes: string;
  user_id?: string;
  usuario_id?: string;
  executor_login?: string;
  metadata?: {
    ip?: string;
    before?: any;
    after?: any;
    severidade?: 'Crítico' | 'Médio' | 'Info';
  };
  severidade?: 'Crítico' | 'Médio' | 'Info';
  ip?: string;
}

export function AuditTrail() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'online' | 'error'>('connecting');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Cache de Logins para resolução de Joins instáveis
  const [userMap, setUserMap] = useState<Record<string, string>>({});

  const TIMEZONE = 'America/Sao_Paulo';
  const COLORS = { BLUE: '#0054A6', RED: '#ED1C24' };

  /**
   * RESOLUÇÃO DE IDENTIDADE: Busca logins separadamente para evitar Erro 400
   */
  const fetchUserMap = async () => {
    try {
      const { data, error } = await supabase.from('users').select('id, login');
      if (error) throw error;
      const map: Record<string, string> = {};
      data?.forEach(u => map[String(u.id)] = u.login);
      setUserMap(map);
      return map;
    } catch (err) {
      console.error('[AUDIT-SRE] Erro ao carregar mapa de logins:', err);
      return {};
    }
  };

  /**
   * FETCH PRINCIPAL: Carregamento de dados com fallback de Join
   */
  const fetchLogs = useCallback(async (currentMap?: Record<string, string>) => {
    try {
      const map = currentMap || userMap;
      const { data, error } = await supabase
        .from('logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200);

      if (error) throw error;

      const normalized = (data || []).map(log => ({
        ...log,
        executor_login: map[String(log.user_id || log.usuario_id)] || 'SISTEMA',
        severidade: log.metadata?.severidade || (
          log.acao.toLowerCase().includes('cancelado') || 
          log.acao.toLowerCase().includes('congelado') ||
          log.modulo === 'ADMIN' ? 'Crítico' : 'Info'
        ),
        ip: log.metadata?.ip || '127.0.0.1'
      }));

      setLogs(normalized);
    } catch (err) {
      console.error('[AUDIT-SRE] Falha no fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [userMap]);

  /**
   * PROTOCOLO REAL-TIME: Escuta a tabela 'logs' para atualizações instantâneas
   */
  useEffect(() => {
    let mapToUse: Record<string, string> = {};

    const initialize = async () => {
      mapToUse = await fetchUserMap();
      fetchLogs(mapToUse);
    };

    initialize();

    // Setup Channel Real-time
    const channel = supabase
      .channel('audit_changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', table: 'logs', schema: 'public' },
        (payload) => {
          console.log('[AUDIT-REALTIME] Novo log detectado:', payload.new.acao);
          const newLog = payload.new as any;
          
          setLogs(prev => {
            const normalized = {
              ...newLog,
              executor_login: mapToUse[String(newLog.user_id || newLog.usuario_id)] || 'SISTEMA',
              severidade: newLog.metadata?.severidade || (
                newLog.acao.toLowerCase().includes('cancelado') || 
                newLog.acao.toLowerCase().includes('congelado') ? 'Crítico' : 'Info'
              ),
              ip: newLog.metadata?.ip || '127.0.0.1'
            };
            return [normalized, ...prev].slice(0, 200);
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('online');
        if (status === 'CHANNEL_ERROR') setRealtimeStatus('error');
      });

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleExportCSV = () => {
    if (logs.length === 0) return;
    const headers = ['Data (RJ)', 'Hora (RJ)', 'Executor', 'Ação', 'Módulo', 'Severidade', 'IP'];
    const rows = [headers.join(',')];
    
    logs.forEach(log => {
      const d = new Date(log.created_at);
      const row = [
        d.toLocaleDateString('pt-BR', { timeZone: TIMEZONE }),
        d.toLocaleTimeString('pt-BR', { timeZone: TIMEZONE }),
        `"${log.executor_login}"`,
        `"${log.acao}"`,
        `"${log.modulo}"`,
        `"${log.severidade}"`,
        `"${log.ip}"`
      ];
      rows.push(row.join(','));
    });

    const csvStr = '\uFEFF' + rows.join('\n');
    const blob = new Blob([csvStr], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Audit_RealTime_RJ_${new Date().getTime()}.csv`;
    link.click();
  };

  const filtered = logs.filter(l => 
    l.acao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.executor_login?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    l.modulo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-4 animate-in fade-in duration-500 font-sans">
      
      {/* HEADER REAL-TIME CLEAN */}
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-xl border border-[#E2E8F0] shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#0054A6]/10 text-[#0054A6] rounded-lg relative">
            <Lock className="w-6 h-6" />
            <div className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white ${realtimeStatus === 'online' ? 'bg-emerald-500' : 'bg-red-500 animate-pulse'}`} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#1A1A1A] tracking-tight uppercase italic" style={{ fontFamily: "'Google Sans', sans-serif" }}>
              Monitor de Auditoria Real-Time
            </h2>
            <div className="flex items-center gap-2 mt-0.5">
              <p className="text-[10px] font-bold text-[#64748B] uppercase tracking-widest">Sincronizado: Rio de Janeiro (UTC-3)</p>
              <div className="w-1 h-1 bg-slate-300 rounded-full" />
              <span className="text-[9px] font-bold text-emerald-600 uppercase flex items-center gap-1">
                {realtimeStatus === 'online' ? <><RefreshCcw className="w-2.5 h-2.5 animate-spin-slow" /> Conexão Ativa</> : 'Aguardando Sinc...'}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              type="text" 
              placeholder="Pesquisar executor ou ação..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#0054A6]/10 w-72 font-medium"
            />
          </div>
          <button 
            onClick={handleExportCSV}
            style={{ backgroundColor: COLORS.BLUE }}
            className="flex items-center gap-2 text-white px-6 py-2.5 rounded-lg font-bold text-xs hover:opacity-90 transition-all shadow-md"
          >
            <Download className="w-4 h-4" />
            Exportar Protocolo
          </button>
        </div>
      </div>

      {/* GRADE OPERACIONAL SRE */}
      <div className="bg-white rounded-xl border border-[#E2E8F0] shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0]">
              <tr>
                <th className="px-5 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Data</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Hora (Brasília/RJ)</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Executor</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">Ação</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider text-center">Severidade</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider">IP Origin</th>
                <th className="px-5 py-3 text-[10px] font-bold text-[#64748B] uppercase tracking-wider text-center">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <tr key={i} className="animate-pulse"><td colSpan={7} className="px-5 py-5"><div className="h-4 bg-slate-50 rounded w-full"></div></td></tr>
                ))
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="px-5 py-24 text-center text-slate-400 font-bold uppercase italic tracking-widest bg-slate-50/50">Aguardando novos logs do RH...</td></tr>
              ) : (
                filtered.map(log => (
                  <tr key={log.id} className={`hover:bg-slate-50 transition-colors animate-in slide-in-from-top duration-300 ${log.severidade === 'Crítico' ? 'bg-red-50/10' : ''}`}>
                    <td className="px-5 py-3 font-mono text-xs text-slate-600 font-bold">
                      {new Date(log.created_at).toLocaleDateString('pt-BR', { timeZone: TIMEZONE })}
                    </td>
                    <td className="px-5 py-3 font-mono text-sm text-slate-800 font-bold">
                      {new Date(log.created_at).toLocaleTimeString('pt-BR', { timeZone: TIMEZONE })}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-[11px] font-bold shadow-sm ${log.severidade === 'Crítico' ? 'bg-[#ED1C24] text-white' : 'bg-slate-200 text-[#0054A6]'}`}>
                          {(log.executor_login || 'S').charAt(0).toUpperCase()}
                        </div>
                        <span className="font-bold text-slate-900 truncate max-w-[120px]">{log.executor_login || 'SISTEMA'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <span className="text-[11px] font-bold text-[#1A1A1A] uppercase italic leading-tight">{log.acao}</span>
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter mt-0.5">{log.modulo}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-md border flex items-center gap-1 ${
                          log.severidade === 'Crítico' ? 'bg-red-50 text-[#ED1C24] border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}>
                          {log.severidade === 'Crítico' && <AlertTriangle className="w-3 h-3" />}
                          {log.severidade}
                        </span>
                      </div>
                    </td>
                    <td className="px-5 py-3 font-mono text-[10px] text-slate-400 font-bold">{log.ip}</td>
                    <td className="px-5 py-3 text-center">
                      <button 
                        onClick={() => { setSelectedLog(log); setIsModalOpen(true); }}
                        className="p-2 rounded-lg hover:bg-[#0054A6] hover:text-white text-slate-400 transition-all"
                      >
                        <SearchIcon className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL FORENSE V5.0 */}
      {isModalOpen && selectedLog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" onClick={() => setIsModalOpen(false)} />
          <div className="relative bg-white w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden border border-slate-200">
            <div className="p-7 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="p-2 bg-[#0054A6] text-white rounded-xl shadow-lg">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-900 uppercase italic">Transaction Details</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Status Sync: America/Sao_Paulo (RJ)</p>
                </div>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)} 
                className="p-2.5 hover:bg-slate-200 rounded-2xl transition-all"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-8">
              <div className="bg-[#1A1A1A] rounded-2xl p-6 font-mono text-[11px] text-emerald-400 overflow-y-auto max-h-[45vh] shadow-2xl">
                <pre>{JSON.stringify(selectedLog.metadata || { "action": selectedLog.acao, "details": selectedLog.detalhes }, null, 2)}</pre>
              </div>
              
              <div className="grid grid-cols-2 gap-6 mt-8">
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Horário RJ (UTC-3)</span>
                  <p className="text-sm font-bold text-slate-800 mt-2 italic shadow-text">
                    {new Date(selectedLog.created_at).toLocaleTimeString('pt-BR', { timeZone: TIMEZONE })}
                  </p>
                </div>
                <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Client Origin</span>
                  <p className="text-sm font-bold text-slate-800 mt-2">{selectedLog.ip}</p>
                </div>
              </div>
            </div>

            <div className="p-8 bg-slate-50 border-t border-slate-100 flex justify-end">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-10 py-3.5 bg-[#0054A6] text-white font-bold rounded-2xl text-xs shadow-xl active:scale-95"
              >
                ENCERRAR ANALISE
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
