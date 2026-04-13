import React, { useState, useEffect } from 'react';
import { 
  Activity, Zap, Database, BarChart, Bell, RefreshCw, 
  Shield, Cpu, Layers, Terminal, AlertTriangle, CheckCircle2,
  Play, Info, Gauge, Search, Clock, Server
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  Legend, ResponsiveContainer, AreaChart, Area, BarChart as ReBarChart, Bar,
  Cell, PieChart, Pie
} from 'recharts';

// Mock data for performance metrics
const performanceData = [
  { time: '10:00', latency: 120, throughput: 45, errors: 0 },
  { time: '10:05', latency: 132, throughput: 52, errors: 1 },
  { time: '10:10', latency: 115, throughput: 48, errors: 0 },
  { time: '10:15', latency: 145, throughput: 65, errors: 2 },
  { time: '10:20', latency: 180, throughput: 80, errors: 5 },
  { time: '10:25', latency: 150, throughput: 72, errors: 1 },
  { time: '10:30', latency: 125, throughput: 55, errors: 0 },
];

const dbMetrics = [
  { name: 'Reads', value: 4500 },
  { name: 'Writes', value: 1200 },
  { name: 'Deletes', value: 300 },
];

const COLORS = ['#00b4d8', '#0077b6', '#001b54'];

export function AdminPerformance() {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationLog, setSimulationLog] = useState<string[]>([]);
  const [metrics, setMetrics] = useState(performanceData);

  const addLog = (msg: string) => {
    setSimulationLog(prev => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev].slice(0, 10));
  };

  const runSimulation = (type: string) => {
    setIsSimulating(true);
    setSimulationLog([]);
    addLog(`Iniciando ${type}...`);
    
    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step === 1) addLog('Provisionando agentes de carga em múltiplas regiões...');
      if (step === 2) addLog('Iniciando fase de ramp-up: 100 usuários simultâneos...');
      if (step === 3) addLog('Monitorando latência de P99 nos endpoints críticos...');
      if (step === 4) addLog('Alcançado pico de carga: 1000 usuários simultâneos.');
      if (step === 5) {
        addLog('Simulação concluída. Gerando relatório de performance...');
        setIsSimulating(false);
        clearInterval(interval);
      }
    }, 1500);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Activity className="w-7 h-7 text-primary" />
            Performance, Observabilidade & SRE
          </h1>
          <p className="text-slate-500">Estratégia completa de monitoramento e sustentação para o DFL Recruta AI.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => runSimulation('Load Test')}
            disabled={isSimulating}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50 text-sm"
          >
            <Play className="w-4 h-4" /> Simular Carga
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: Gauge },
          { id: 'critical', label: 'Pontos Críticos', icon: AlertTriangle },
          { id: 'testing', label: 'Testes de Carga', icon: Zap },
          { id: 'database', label: 'Banco de Dados', icon: Database },
          { id: 'observability', label: 'Observabilidade', icon: Layers },
          { id: 'alerts', label: 'Alertas & SLOs', icon: Bell },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-6 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
              activeTab === tab.id 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="grid grid-cols-1 gap-6">
        
        {activeTab === 'overview' && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase">Latência Média (P95)</p>
                <h3 className="text-2xl font-bold text-slate-900">142ms</h3>
                <div className="mt-2 flex items-center gap-1 text-emerald-600 text-xs">
                  <Activity className="w-3 h-3" /> -12% vs última hora
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase">Taxa de Erro</p>
                <h3 className="text-2xl font-bold text-slate-900">0.04%</h3>
                <div className="mt-2 flex items-center gap-1 text-emerald-600 text-xs">
                  <CheckCircle2 className="w-3 h-3" /> Dentro do SLO (0.5%)
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase">Throughput</p>
                <h3 className="text-2xl font-bold text-slate-900">58 req/s</h3>
                <div className="mt-2 flex items-center gap-1 text-blue-600 text-xs">
                  <RefreshCw className="w-3 h-3" /> Estável
                </div>
              </div>
              <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <p className="text-xs font-medium text-slate-500 uppercase">Uso de CPU (Avg)</p>
                <h3 className="text-2xl font-bold text-slate-900">24%</h3>
                <div className="mt-2 flex items-center gap-1 text-emerald-600 text-xs">
                  <Cpu className="w-3 h-3" /> Otimizado
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Latência vs Throughput</h3>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics}>
                      <defs>
                        <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00b4d8" stopOpacity={0.1}/>
                          <stop offset="95%" stopColor="#00b4d8" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                      <XAxis dataKey="time" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      />
                      <Area type="monotone" dataKey="latency" stroke="#00b4d8" fillOpacity={1} fill="url(#colorLat)" strokeWidth={2} name="Latência (ms)" />
                      <Area type="monotone" dataKey="throughput" stroke="#001b54" fill="transparent" strokeWidth={2} name="Throughput (req/s)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Distribuição de Operações DB</h3>
                <div className="h-64 flex items-center justify-center">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={dbMetrics}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {dbMetrics.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'critical' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-6 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Mapeamento de Pontos Críticos</h3>
              <p className="text-sm text-slate-500">Identificação de gargalos potenciais e fluxos de alta prioridade.</p>
            </div>
            <div className="p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Server className="w-4 h-4 text-primary" /> Endpoints Críticos (API)
                  </h4>
                  <ul className="space-y-3">
                    <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-mono font-bold text-slate-700">POST /api/auth/login</span>
                        <span className="text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded">ALTA CARGA</span>
                      </div>
                      <p className="text-xs text-slate-500">Ponto de entrada único. Sensível a ataques de força bruta e picos de acesso.</p>
                    </li>
                    <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-mono font-bold text-slate-700">GET /api/vagas/search</span>
                        <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded">QUERY PESADA</span>
                      </div>
                      <p className="text-xs text-slate-500">Consultas complexas com múltiplos filtros. Requer indexação otimizada no Supabase.</p>
                    </li>
                  </ul>
                </div>

                <div className="space-y-4">
                  <h4 className="font-bold text-slate-800 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Telas Críticas (Frontend)
                  </h4>
                  <ul className="space-y-3">
                    <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-slate-700">Dashboard RH</span>
                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded">RENDERIZAÇÃO</span>
                      </div>
                      <p className="text-xs text-slate-500">Múltiplos gráficos e tabelas. Risco de re-renders excessivos e lentidão em dispositivos móveis.</p>
                    </li>
                    <li className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-bold text-slate-700">Exportação de Relatórios</span>
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded">CPU INTENSIVO</span>
                      </div>
                      <p className="text-xs text-slate-500">Geração de PDF/CSV no cliente. Pode travar a thread principal se não for via Web Workers.</p>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'testing' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4">Simulação de Cenários Reais</h3>
                <div className="grid grid-cols-1 gap-3">
                  <button 
                    onClick={() => runSimulation('Pico de Acesso (Black Friday)')}
                    disabled={isSimulating}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <Zap className="w-5 h-5 text-amber-500" />
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-900">Pico de Acesso</p>
                        <p className="text-[10px] text-slate-500">1000 usuários simultâneos em 1 min</p>
                      </div>
                    </div>
                    <Play className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                  </button>
                  <button 
                    onClick={() => runSimulation('Queda Parcial de Serviço (DB Latency)')}
                    disabled={isSimulating}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-900">Degradação de Banco</p>
                        <p className="text-[10px] text-slate-500">Simula latência de 2s no Supabase</p>
                      </div>
                    </div>
                    <Play className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                  </button>
                  <button 
                    onClick={() => runSimulation('Vazamento de Memória (Soak Test)')}
                    disabled={isSimulating}
                    className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <RefreshCw className="w-5 h-5 text-blue-500" />
                      <div className="text-left">
                        <p className="text-sm font-bold text-slate-900">Soak Test</p>
                        <p className="text-[10px] text-slate-500">Carga constante por longo período</p>
                      </div>
                    </div>
                    <Play className="w-4 h-4 text-slate-400 group-hover:text-primary" />
                  </button>
                </div>
              </div>

              <div className="bg-slate-900 rounded-xl shadow-lg p-6 text-slate-300 font-mono text-xs overflow-hidden flex flex-col h-[300px]">
                <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-2">
                  <span className="flex items-center gap-2"><Terminal className="w-4 h-4" /> Simulation Console</span>
                  <div className="flex gap-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                    <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto space-y-1">
                  {simulationLog.length === 0 ? (
                    <p className="text-slate-600 italic">Aguardando comando de simulação...</p>
                  ) : (
                    simulationLog.map((log, i) => (
                      <p key={i} className={i === 0 ? 'text-emerald-400' : ''}>{log}</p>
                    ))
                  )}
                  {isSimulating && <p className="animate-pulse">_</p>}
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Exemplo de Script (k6)</h3>
              <pre className="bg-slate-50 p-4 rounded-lg text-xs font-mono text-slate-700 overflow-x-auto">
{`import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 100 }, // ramp-up
    { duration: '5m', target: 100 }, // stable
    { duration: '2m', target: 0 },   // ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'], // 95% das reqs < 200ms
    http_req_failed: ['rate<0.01'],   // Erros < 1%
  },
};

export default function () {
  const res = http.get('https://dfl-recruta.run.app/api/vagas');
  check(res, { 'status was 200': (r) => r.status == 200 });
  sleep(1);
}`}
              </pre>
            </div>
          </div>
        )}

        {activeTab === 'database' && (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Estratégia Supabase</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                    <Search className="w-4 h-4 text-primary" /> Indexação
                  </h4>
                  <p className="text-xs text-slate-500">Uso de índices compostos para filtros complexos (ex: status + data + perfil). Evitar queries "inefficient" que leem muitos documentos.</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" /> Monitoramento
                  </h4>
                  <p className="text-xs text-slate-500">Acompanhamento de Read/Write Quotas. Alertas de picos de escrita que podem indicar loops infinitos no frontend.</p>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-slate-100">
                  <h4 className="font-bold text-sm mb-2 flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" /> Estrutura
                  </h4>
                  <p className="text-xs text-slate-500">Desnormalização controlada para evitar "joins" no cliente. Uso de subcoleções para dados isolados por usuário.</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
              <h3 className="text-lg font-bold text-slate-900 mb-4">Queries de Diagnóstico (Simuladas)</h3>
              <div className="space-y-4">
                <div className="p-4 bg-slate-900 rounded-lg font-mono text-xs text-emerald-400">
                  <p className="text-slate-500 mb-1">// Identificar queries lentas no console do Supabase</p>
                  <p>Configuração de índices concluída no Supabase.</p>
                  <p className="mt-2 text-slate-500">// Simulação de análise de plano de execução</p>
                  <p>EXPLAIN SELECT * FROM candidaturas WHERE status = 'Pendente' ORDER BY createdAt DESC;</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'observability' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <Terminal className="w-5 h-5 text-primary" /> Logs
                </h3>
                <p className="text-sm text-slate-600 mb-4">Padrão JSON estruturado para fácil ingestão e busca.</p>
                <pre className="bg-slate-50 p-3 rounded-lg text-[10px] font-mono text-slate-700">
{`{
  "timestamp": "2026-03-17T...",
  "level": "ERROR",
  "service": "api-gateway",
  "traceId": "a1b2c3d4",
  "message": "DB Connection Timeout",
  "context": { "db": "firestore", "latency": 5000 }
}`}
                </pre>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <BarChart className="w-5 h-5 text-primary" /> Métricas
                </h3>
                <ul className="text-sm text-slate-600 space-y-2">
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Latência (P50, P95, P99)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Taxa de Erro (4xx, 5xx)</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-500" /> Saturação de Recursos</li>
                </ul>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                  <RefreshCw className="w-5 h-5 text-primary" /> Tracing
                </h3>
                <p className="text-sm text-slate-600 mb-4">Rastreamento distribuído via OpenTelemetry.</p>
                <div className="space-y-2">
                  <div className="h-2 bg-primary/20 rounded-full w-full"></div>
                  <div className="h-2 bg-primary/40 rounded-full w-3/4 ml-4"></div>
                  <div className="h-2 bg-primary/60 rounded-full w-1/2 ml-8"></div>
                  <p className="text-[10px] text-slate-400 text-center mt-2">Visualização de Spans e Gargalos</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'alerts' && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
                <tr>
                  <th className="px-6 py-4">Indicador (SLI)</th>
                  <th className="px-6 py-4">Meta (SLO)</th>
                  <th className="px-6 py-4">Regra de Alerta</th>
                  <th className="px-6 py-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr>
                  <td className="px-6 py-4 font-medium">Disponibilidade</td>
                  <td className="px-6 py-4">99.9%</td>
                  <td className="px-6 py-4 text-slate-500">Uptime &lt; 99.5% por 5 min</td>
                  <td className="px-6 py-4"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs">SAUDÁVEL</span></td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Latência P95</td>
                  <td className="px-6 py-4">&lt; 300ms</td>
                  <td className="px-6 py-4 text-slate-500">Latência &gt; 500ms por 2 min</td>
                  <td className="px-6 py-4"><span className="bg-emerald-100 text-emerald-700 px-2 py-1 rounded text-xs">SAUDÁVEL</span></td>
                </tr>
                <tr>
                  <td className="px-6 py-4 font-medium">Taxa de Erro 5xx</td>
                  <td className="px-6 py-4">&lt; 0.1%</td>
                  <td className="px-6 py-4 text-slate-500">Erros &gt; 1% por 1 min</td>
                  <td className="px-6 py-4"><span className="bg-amber-100 text-amber-700 px-2 py-1 rounded text-xs">ATENÇÃO</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

      </div>

      {/* CI/CD Section */}
      <div className="bg-slate-900 rounded-2xl p-8 text-white">
        <div className="flex items-center gap-4 mb-6">
          <div className="p-3 bg-white/10 rounded-xl">
            <RefreshCw className="w-8 h-8 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Automação Contínua (CI/CD)</h2>
            <p className="text-slate-400 text-sm">Integração de testes de performance no pipeline de deploy.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="border border-white/10 p-4 rounded-xl bg-white/5">
            <h4 className="font-bold mb-2 text-blue-300">1. Build & Lint</h4>
            <p className="text-xs text-slate-400">Validação estática e compilação. Bloqueia se houver erros de sintaxe ou tipos.</p>
          </div>
          <div className="border border-white/10 p-4 rounded-xl bg-white/5">
            <h4 className="font-bold mb-2 text-emerald-300">2. Performance Check</h4>
            <p className="text-xs text-slate-400">Execução de k6 em ambiente de staging. Falha o build se a latência P95 subir &gt; 10%.</p>
          </div>
          <div className="border border-white/10 p-4 rounded-xl bg-white/5">
            <h4 className="font-bold mb-2 text-purple-300">3. Canary Deploy</h4>
            <p className="text-xs text-slate-400">Deploy para 5% dos usuários. Monitoramento automático de métricas de erro antes do rollout total.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
