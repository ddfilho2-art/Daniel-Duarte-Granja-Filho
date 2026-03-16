import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Users, CheckSquare, MessageSquare, FileCheck, Plus, Search, MoreVertical, Clock, TrendingUp, Target, Heart, Award, PieChart as PieChartIcon, BarChart3, Download, Filter, XCircle, PauseCircle, PlayCircle, CheckCircle, ArrowLeft, Save, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, LabelList } from 'recharts';
import domtoimage from 'dom-to-image';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';

const tempoPorEtapaData = [
  { name: 'Triagem', dias: 2 },
  { name: 'Entrevista RH', dias: 5 },
  { name: 'Teste Técnico', dias: 7 },
  { name: 'Entrevista Gestor', dias: 12 },
  { name: 'Proposta', dias: 3 },
];

const funilData = [
  { name: 'Inscritos', value: 1200 },
  { name: 'Triagem', value: 450 },
  { name: 'Entrevista RH', value: 150 },
  { name: 'Entrevista Gestor', value: 45 },
  { name: 'Contratados', value: 12 },
];

const motivosDeclinioData = [
  { name: 'Salário', value: 40 },
  { name: 'Benefícios', value: 25 },
  { name: 'Modelo de Trabalho', value: 20 },
  { name: 'Outros', value: 15 },
];

const volumeContratacoesData = [
  { name: 'Jan', contratacoes: 15 },
  { name: 'Fev', contratacoes: 22 },
  { name: 'Mar', contratacoes: 18 },
  { name: 'Abr', contratacoes: 30 },
  { name: 'Mai', contratacoes: 25 },
  { name: 'Jun', contratacoes: 35 },
];

const fonteOrigemData = [
  { name: 'LinkedIn', value: 45 },
  { name: 'Indicação', value: 30 },
  { name: 'Site DFL', value: 15 },
  { name: 'Gupy/Outros', value: 10 },
];

const COLORS = ['#818cf8', '#34d399', '#fbbf24', '#fb7185', '#a78bfa'];
const PRIMARY_COLORS = ['#38bdf8', '#4ade80', '#facc15', '#f472b6', '#c084fc'];

export function HRDashboard() {
  const dashboardRef = useRef<HTMLDivElement>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);

  const handleGeneratePDF = async () => {
    if (!dashboardRef.current) return;
    
    try {
      setIsGeneratingPDF(true);
      
      // Aguarda um pequeno intervalo para garantir que as animações dos gráficos terminaram
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const targetNode = dashboardRef.current;
      const width = targetNode.scrollWidth;
      const height = targetNode.scrollHeight;
      
      const imgData = await domtoimage.toPng(targetNode, { 
        bgcolor: '#f8fafc',
        width: width,
        height: height,
        quality: 1,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          margin: '0'
        },
        filter: (node: Node) => {
          if (node instanceof HTMLElement) {
            return !node.classList.contains('hide-on-print');
          }
          return true;
        }
      });
      
      const pdf = new jsPDF({
        orientation: width > height ? 'landscape' : 'portrait',
        unit: 'px',
        format: [width, height]
      });
      
      pdf.addImage(imgData, 'PNG', 0, 0, width, height);
      pdf.save('relatorio_dashboard.pdf');
    } catch (error) {
      console.error('Erro ao gerar PDF:', error);
      alert('Ocorreu um erro ao gerar o PDF. Tente novamente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleExportCSV = () => {
    // Dados simulados para as 10 tabelas solicitadas
    const candidatos = [
      { ID: 1, Nome: 'Ana Silva', Email: 'ana@email.com', Telefone: '11999999999', Cidade: 'São Paulo', Estado: 'SP', Data_Cadastro: '2023-01-15' },
      { ID: 2, Nome: 'Carlos Santos', Email: 'carlos@email.com', Telefone: '21988888888', Cidade: 'Rio de Janeiro', Estado: 'RJ', Data_Cadastro: '2023-02-20' },
      { ID: 3, Nome: 'Mariana Costa', Email: 'mariana@email.com', Telefone: '31977777777', Cidade: 'Belo Horizonte', Estado: 'MG', Data_Cadastro: '2023-03-10' },
    ];

    const vagas = [
      { ID: 101, Titulo: 'Desenvolvedor Frontend', Departamento: 'Tecnologia', Local: 'Remoto', Status: 'Aberta', Data_Abertura: '2023-05-01', Vagas_Disponiveis: 2 },
      { ID: 102, Titulo: 'Analista de RH', Departamento: 'Recursos Humanos', Local: 'São Paulo', Status: 'Fechada', Data_Abertura: '2023-04-10', Vagas_Disponiveis: 1 },
      { ID: 103, Titulo: 'Gerente de Projetos', Departamento: 'Operações', Local: 'Rio de Janeiro', Status: 'Aberta', Data_Abertura: '2023-06-15', Vagas_Disponiveis: 1 },
    ];

    const candidaturas = [
      { ID: 1001, Candidato_ID: 1, Vaga_ID: 101, Data_Candidatura: '2023-05-05', Status_Atual: 'Entrevista Técnica', Origem: 'LinkedIn' },
      { ID: 1002, Candidato_ID: 2, Vaga_ID: 102, Data_Candidatura: '2023-04-12', Status_Atual: 'Contratado', Origem: 'Indicação' },
      { ID: 1003, Candidato_ID: 3, Vaga_ID: 101, Data_Candidatura: '2023-05-06', Status_Atual: 'Triagem', Origem: 'Site DFL' },
    ];

    const etapasProcesso = [
      { ID: 1, Vaga_ID: 101, Ordem: 1, Nome_Etapa: 'Triagem', Tipo: 'Filtro' },
      { ID: 2, Vaga_ID: 101, Ordem: 2, Nome_Etapa: 'Entrevista RH', Tipo: 'Entrevista' },
      { ID: 3, Vaga_ID: 101, Ordem: 3, Nome_Etapa: 'Teste Técnico', Tipo: 'Avaliação' },
      { ID: 4, Vaga_ID: 101, Ordem: 4, Nome_Etapa: 'Entrevista Gestor', Tipo: 'Entrevista' },
      { ID: 5, Vaga_ID: 101, Ordem: 5, Nome_Etapa: 'Proposta', Tipo: 'Oferta' },
    ];

    const movimentacaoEtapas = [
      { ID: 501, Candidatura_ID: 1001, Etapa_Origem: 'Triagem', Etapa_Destino: 'Entrevista RH', Data_Movimentacao: '2023-05-10', Responsavel: 'João RH' },
      { ID: 502, Candidatura_ID: 1001, Etapa_Origem: 'Entrevista RH', Etapa_Destino: 'Teste Técnico', Data_Movimentacao: '2023-05-15', Responsavel: 'João RH' },
      { ID: 503, Candidatura_ID: 1002, Etapa_Origem: 'Entrevista Gestor', Etapa_Destino: 'Proposta', Data_Movimentacao: '2023-04-25', Responsavel: 'Maria Gestora' },
    ];

    const entrevistas = [
      { ID: 301, Candidatura_ID: 1001, Entrevistador: 'João RH', Data_Agendada: '2023-05-12 14:00', Status: 'Realizada', Nota: 8.5, Feedback: 'Ótima comunicação.' },
      { ID: 302, Candidatura_ID: 1002, Entrevistador: 'Maria Gestora', Data_Agendada: '2023-04-20 10:00', Status: 'Realizada', Nota: 9.0, Feedback: 'Excelente fit cultural.' },
    ];

    const ofertasPropostas = [
      { ID: 401, Candidatura_ID: 1002, Data_Oferta: '2023-04-26', Salario_Oferecido: 8500.00, Status_Oferta: 'Aceita', Data_Resposta: '2023-04-27' },
      { ID: 402, Candidatura_ID: 1004, Data_Oferta: '2023-05-20', Salario_Oferecido: 6000.00, Status_Oferta: 'Recusada', Data_Resposta: '2023-05-22' },
    ];

    const fontesRecrutamento = [
      { ID: 1, Nome_Fonte: 'LinkedIn', Custo_Mensal: 1500.00, Total_Candidatos: 450, Contratacoes: 5 },
      { ID: 2, Nome_Fonte: 'Gupy', Custo_Mensal: 2000.00, Total_Candidatos: 800, Contratacoes: 8 },
      { ID: 3, Nome_Fonte: 'Indicação Interna', Custo_Mensal: 0.00, Total_Candidatos: 50, Contratacoes: 10 },
      { ID: 4, Nome_Fonte: 'Site DFL', Custo_Mensal: 0.00, Total_Candidatos: 300, Contratacoes: 2 },
    ];

    const motivosRecusa = [
      { ID: 1, Candidatura_ID: 1004, Fase_Recusa: 'Proposta', Motivo_Principal: 'Salário abaixo da expectativa', Detalhes: 'Candidato recebeu contraproposta.' },
      { ID: 2, Candidatura_ID: 1005, Fase_Recusa: 'Entrevista Gestor', Motivo_Principal: 'Falta de conhecimento técnico', Detalhes: 'Não passou no teste de React.' },
      { ID: 3, Candidatura_ID: 1006, Fase_Recusa: 'Triagem', Motivo_Principal: 'Fora do perfil', Detalhes: 'Experiência insuficiente.' },
    ];

    const diversidade = [
      { Candidato_ID: 1, Genero: 'Feminino', Raca_Cor: 'Branca', PCD: 'Não', Faixa_Etaria: '25-34' },
      { Candidato_ID: 2, Genero: 'Masculino', Raca_Cor: 'Parda', PCD: 'Não', Faixa_Etaria: '35-44' },
      { Candidato_ID: 3, Genero: 'Feminino', Raca_Cor: 'Preta', PCD: 'Sim', Faixa_Etaria: '18-24' },
    ];

    // Criação do Workbook
    const wb = XLSX.utils.book_new();

    // Adicionando cada tabela como uma aba (Sheet)
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(candidatos), "Candidatos");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vagas), "Vagas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(candidaturas), "Candidaturas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(etapasProcesso), "Etapas do Processo");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(movimentacaoEtapas), "Movimentação nas Etapas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(entrevistas), "Entrevistas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(ofertasPropostas), "Ofertas e Propostas");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(fontesRecrutamento), "Fontes Recrutamento");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(motivosRecusa), "Motivos de Recusa");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(diversidade), "Diversidade");

    // Gerando o arquivo e disparando o download
    XLSX.writeFile(wb, "Base_de_Dados_Recrutamento_DFL.xlsx");
  };

  return (
    <div ref={dashboardRef} className="space-y-8 bg-slate-50 p-6 -m-6 rounded-xl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard de Indicadores</h1>
          <p className="text-slate-500">Visão geral da performance de recrutamento e seleção.</p>
        </div>
        <div className="flex gap-2 hide-on-print">
          <button onClick={handleExportCSV} className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg font-medium hover:bg-slate-50 transition-colors flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" /> Exportar Excel
          </button>
          <button onClick={handleGeneratePDF} disabled={isGeneratingPDF} className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors flex items-center gap-2 text-sm disabled:opacity-70 disabled:cursor-not-allowed">
            <BarChart3 className="w-4 h-4" /> {isGeneratingPDF ? 'Gerando...' : 'Gerar Relatório PDF'}
          </button>
        </div>
      </div>

      <div className="space-y-8">
        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500">Time-to-Fill</p>
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">32 dias</h3>
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> -3 dias vs último mês
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500">Time-to-Hire</p>
            <Clock className="w-4 h-4 text-indigo-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">21 dias</h3>
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> -2 dias vs último mês
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500">Vagas no SLA</p>
            <Target className="w-4 h-4 text-emerald-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">85%</h3>
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +5% vs último mês
          </p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500">Aprovação Gestor</p>
            <CheckSquare className="w-4 h-4 text-amber-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">72%</h3>
          <p className="text-xs text-slate-500 mt-1">Candidatos aprovados</p>
        </div>
        <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200">
          <div className="flex justify-between items-start mb-2">
            <p className="text-sm font-medium text-slate-500">Candidate Score</p>
            <Heart className="w-4 h-4 text-rose-500" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900">8.9<span className="text-sm font-normal text-slate-500">/10</span></h3>
          <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> NPS Excelente
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Eficiência */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Eficiência: Tempo Médio por Etapa (Dias)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={tempoPorEtapaData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={100} fontSize={12} />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="dias" radius={[0, 4, 4, 0]} barSize={24}>
                  {tempoPorEtapaData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PRIMARY_COLORS[index % PRIMARY_COLORS.length]} />
                  ))}
                  <LabelList dataKey="dias" position="right" fill="#64748b" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Qualidade e Conversão */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Qualidade: Funil de Seleção</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funilData} margin={{ top: 20, right: 30, left: 20, bottom: 25 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} interval={0} angle={-25} textAnchor="end" />
                <YAxis domain={[0, dataMax => Math.ceil(dataMax * 1.15)]} />
                <Tooltip cursor={{fill: '#f1f5f9'}} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={40}>
                  {funilData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                  <LabelList dataKey="value" position="top" fill="#64748b" fontSize={12} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Custo e Volume */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <h2 className="text-lg font-bold text-slate-900 mb-4">Volume de Contratações (Últimos 6 meses)</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={volumeContratacoesData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={12} />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="contratacoes" stroke="#0ea5e9" strokeWidth={3} dot={{ r: 4, fill: '#0ea5e9', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="contratacoes" position="top" fill="#64748b" fontSize={12} offset={10} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Fontes e Motivos */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 mb-4 text-center">Fonte de Origem</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={fonteOrigemData} 
                    cx="50%" 
                    cy="50%" 
                    innerRadius={40} 
                    outerRadius={70} 
                    paddingAngle={2} 
                    dataKey="value"
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius * 1.2;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10">
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    labelLine={false}
                  >
                    {fonteOrigemData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={PRIMARY_COLORS[index % PRIMARY_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {fonteOrigemData.map((item, i) => (
                <div key={i} className="flex items-center gap-1 text-xs text-slate-600">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: PRIMARY_COLORS[i % PRIMARY_COLORS.length] }}></div>
                  {item.name}
                </div>
              ))}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <h2 className="text-sm font-bold text-slate-900 mb-4 text-center">Motivos de Declínio</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie 
                    data={motivosDeclinioData} 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={70} 
                    dataKey="value"
                    label={({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = outerRadius * 1.2;
                      const x = cx + radius * Math.cos(-midAngle * RADIAN);
                      const y = cy + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={x} y={y} fill="#64748b" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="10">
                          {`${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }}
                    labelLine={false}
                  >
                    {motivosDeclinioData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-2 mt-2">
              {motivosDeclinioData.map((item, i) => (
                <div key={i} className="flex items-center gap-1 text-xs text-slate-600">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}></div>
                  {item.name}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Diversidade */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-bold text-slate-900">Diversidade no Funil (Geral)</h2>
          <Award className="w-5 h-5 text-slate-400" />
        </div>
        <div className="space-y-6">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">Gênero (Mulheres)</span>
              <span className="text-slate-500">48% na triagem / 42% contratadas</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-indigo-500 h-2.5 rounded-full" style={{ width: '45%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">Raça/Etnia (Pretos e Pardos)</span>
              <span className="text-slate-500">35% na triagem / 30% contratados</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-emerald-500 h-2.5 rounded-full" style={{ width: '32%' }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-medium text-slate-700">Pessoas com Deficiência (PcD)</span>
              <span className="text-slate-500">8% na triagem / 5% contratados</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2.5">
              <div className="bg-amber-500 h-2.5 rounded-full" style={{ width: '6%' }}></div>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}

export function HRGestaoVagas() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  const navigate = useNavigate();

  const now = new Date();
  const duasHorasAtras = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const doisDiasAtras = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
  const cincoDiasAtras = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
  const dezDiasAtras = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000).toISOString();

  const [vagas, setVagas] = useState([
    { id: 6, cargo: 'Desenvolvedor Full Stack', local: 'Remoto', criadaEm: now.toISOString(), status: 'Aberta' },
    { id: 1, cargo: 'Analista de Qualidade Pleno', local: 'Rio de Janeiro, RJ', criadaEm: duasHorasAtras, status: 'Aberta' },
    { id: 2, cargo: 'Engenheiro de Produção Sênior', local: 'São Paulo, SP', criadaEm: doisDiasAtras, status: 'Pausada' },
    { id: 3, cargo: 'Técnico de Manutenção', local: 'Belo Horizonte, MG', criadaEm: cincoDiasAtras, status: 'Aberta' },
    { id: 4, cargo: 'Coordenador de Logística', local: 'Curitiba, PR', criadaEm: dezDiasAtras, status: 'Encerrada' },
    { id: 5, cargo: 'Assistente Administrativo', local: 'Rio de Janeiro, RJ', criadaEm: dezDiasAtras, status: 'Cancelada' },
  ]);

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
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

  const filteredVagas = vagas.filter(vaga => {
    const matchesSearch = vaga.cargo.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    for (const [key, value] of Object.entries(columnFilters)) {
      if (!value) continue;
      
      let itemValue = String(vaga[key as keyof typeof vaga] || '').toLowerCase();
      if (key === 'criadaEm') {
        itemValue = formatDateTime(vaga.criadaEm).toLowerCase();
      }
      
      if (!itemValue.includes(String(value).toLowerCase())) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any = a[key as keyof typeof a];
    let bValue: any = b[key as keyof typeof b];

    if (key === 'criadaEm') {
      aValue = new Date(a.criadaEm).getTime();
      bValue = new Date(b.criadaEm).getTime();
    } else {
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const handleAction = (id: number, action: string) => {
    setVagas(vagas.map(vaga => {
      if (vaga.id === id) {
        if (action === 'Pausar') return { ...vaga, status: 'Pausada' };
        if (action === 'Retomar') return { ...vaga, status: 'Aberta' };
        if (action === 'Encerrar') return { ...vaga, status: 'Encerrada' };
        if (action === 'Cancelar') {
          const createdTime = new Date(vaga.criadaEm).getTime();
          const currentTime = new Date().getTime();
          const hoursDiff = (currentTime - createdTime) / (1000 * 60 * 60);
          
          if (hoursDiff <= 24) {
            return { ...vaga, status: 'Cancelada' };
          } else {
            alert('Não é possível cancelar esta vaga. O prazo de 24 horas após a criação expirou.');
            return vaga;
          }
        }
      }
      return vaga;
    }));
  };

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const renderFilterInput = (key: string, label: string) => {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between cursor-pointer group" onClick={() => handleSort(key)}>
          <span>{label}</span>
          <div className="flex items-center gap-1">
            {renderSortIcon(key)}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterColumn(activeFilterColumn === key ? null : key);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? 'text-primary' : 'text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}
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
            value={columnFilters[key] || ''}
            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-2 py-1 text-xs font-normal border border-slate-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          />
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-4 w-full max-w-2xl">
          <div className="bg-white p-2 rounded-xl shadow-sm border border-slate-200 flex items-center gap-2 flex-1">
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
        <button onClick={() => navigate('/rh/vagas/nova')} className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Nova Vaga
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 align-top w-1/4">{renderFilterInput('cargo', 'Cargo')}</th>
                <th className="px-6 py-4 align-top w-1/4">{renderFilterInput('local', 'Local')}</th>
                <th className="px-6 py-4 align-top w-1/4">{renderFilterInput('criadaEm', 'Criada em (Data/Hora)')}</th>
                <th className="px-6 py-4 align-top w-1/6">{renderFilterInput('status', 'Status')}</th>
                <th className="px-6 py-4 text-center align-top">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVagas.map((vaga) => (
                <tr key={vaga.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">
                    <Link to={`/rh/vagas/${vaga.id}/candidatos`} className="hover:text-primary transition-colors">
                      {vaga.cargo}
                    </Link>
                  </td>
                  <td className="px-6 py-4">{vaga.local}</td>
                  <td className="px-6 py-4">{formatDateTime(vaga.criadaEm)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      vaga.status === 'Aberta' ? 'bg-emerald-100 text-emerald-700' :
                      vaga.status === 'Pausada' ? 'bg-amber-100 text-amber-700' :
                      vaga.status === 'Encerrada' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {vaga.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex justify-center gap-2">
                      {vaga.status === 'Aberta' && (
                        <button onClick={() => handleAction(vaga.id, 'Pausar')} className="text-amber-500 hover:text-amber-700" title="Pausar">
                          <PauseCircle className="w-5 h-5" />
                        </button>
                      )}
                      {vaga.status === 'Pausada' && (
                        <button onClick={() => handleAction(vaga.id, 'Retomar')} className="text-emerald-500 hover:text-emerald-700" title="Retomar">
                          <PlayCircle className="w-5 h-5" />
                        </button>
                      )}
                      {(vaga.status === 'Aberta' || vaga.status === 'Pausada') && (
                        <>
                          <button onClick={() => handleAction(vaga.id, 'Encerrar')} className="text-blue-500 hover:text-blue-700" title="Encerrar (Contratado)">
                            <CheckCircle className="w-5 h-5" />
                          </button>
                          <button onClick={() => handleAction(vaga.id, 'Cancelar')} className="text-red-500 hover:text-red-700" title="Cancelar Vaga">
                            <XCircle className="w-5 h-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filteredVagas.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhuma vaga encontrada com os filtros atuais.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export function HRNovaVaga() {
  const navigate = useNavigate();
  const [isSaved, setIsSaved] = useState(false);
  const [exigeProva, setExigeProva] = useState('Não');
  const [selectedCertificacoes, setSelectedCertificacoes] = useState<string[]>([]);
  const [outraCertificacao, setOutraCertificacao] = useState('');

  const certificacoesPadrao = [
    'PMP (Project Management Professional)',
    'Scrum Master (CSM/PSM)',
    'ITIL',
    'COBIT',
    'AWS Certified Solutions Architect',
    'Microsoft Certified: Azure Solutions Architect',
    'Google Cloud Professional Cloud Architect',
    'CISSP (Certified Information Systems Security Professional)',
    'CISM (Certified Information Security Manager)',
    'CompTIA Security+',
    'Cisco CCNA/CCNP',
    'Six Sigma Green Belt',
    'Six Sigma Black Belt',
    'CPA-10 / CPA-20 / CEA',
    'CFA (Chartered Financial Analyst)',
    'ISO 9001 Lead Auditor',
    'ISO 27001 Lead Auditor',
    'Salesforce Certified Administrator',
    'HubSpot Inbound Marketing',
    'Outros'
  ];

  const handleCertificacaoChange = (cert: string) => {
    if (selectedCertificacoes.includes(cert)) {
      setSelectedCertificacoes(selectedCertificacoes.filter(c => c !== cert));
    } else {
      setSelectedCertificacoes([...selectedCertificacoes, cert]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      navigate('/rh/vagas');
    }, 2000);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-slate-900">Criar Nova Vaga</h2>
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Informações Básicas */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">Informações Básicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Título da Vaga <span className="text-red-500">*</span></label>
                <input required type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Ex: Desenvolvedor Front-end Sênior" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Departamento / Área <span className="text-red-500">*</span></label>
                <select required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                  <option value="">Selecione</option>
                  <option value="Tecnologia">Tecnologia</option>
                  <option value="Recursos Humanos">Recursos Humanos</option>
                  <option value="Financeiro">Financeiro</option>
                  <option value="Marketing">Marketing</option>
                  <option value="Operações">Operações</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo de Trabalho <span className="text-red-500">*</span></label>
                <select required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                  <option value="">Selecione</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Híbrido">Híbrido</option>
                  <option value="Remoto">Remoto</option>
                </select>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Endereço / Local de Trabalho <span className="text-red-500">*</span></label>
                  <input required type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Ex: Rua Exemplo, 123 - São Paulo, SP" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CEP <span className="text-red-500">*</span></label>
                  <input required type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="00000-000" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Contrato <span className="text-red-500">*</span></label>
                <select required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                  <option value="">Selecione</option>
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="Estágio">Estágio</option>
                  <option value="Temporário">Temporário</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Faixa Salarial</label>
                <input type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Ex: R$ 5.000 - R$ 7.000 (Opcional)" />
              </div>
            </div>
          </div>

          {/* Descrição e Requisitos */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">Descrição e Requisitos</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição da Vaga <span className="text-red-500">*</span></label>
                <textarea required rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Descreva as responsabilidades e o dia a dia da função..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Requisitos e Qualificações <span className="text-red-500">*</span></label>
                <textarea required rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Liste os requisitos técnicos e comportamentais..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Benefícios</label>
                <textarea rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Liste os benefícios oferecidos..."></textarea>
              </div>
            </div>
          </div>

          {/* Avaliação e Certificações */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">Avaliação e Certificações</h3>
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Necessário Prova de Avaliação? <span className="text-red-500">*</span></label>
                  <select 
                    required 
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    value={exigeProva}
                    onChange={(e) => setExigeProva(e.target.value)}
                  >
                    <option value="Não">Não</option>
                    <option value="Sim">Sim</option>
                  </select>
                </div>
                {exigeProva === 'Sim' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Qual Prova? <span className="text-red-500">*</span></label>
                    <input 
                      required 
                      type="text" 
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                      placeholder="Ex: Teste de Lógica, Case Técnico..." 
                    />
                  </div>
                )}
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-3">Certificações Desejadas / Obrigatórias</label>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  {certificacoesPadrao.map((cert) => (
                    <label key={cert} className="flex items-start gap-2 cursor-pointer group">
                      <input 
                        type="checkbox" 
                        className="mt-1 w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                        checked={selectedCertificacoes.includes(cert)}
                        onChange={() => handleCertificacaoChange(cert)}
                      />
                      <span className="text-sm text-slate-700 group-hover:text-slate-900 leading-tight">{cert}</span>
                    </label>
                  ))}
                </div>
                {selectedCertificacoes.includes('Outros') && (
                  <div className="mt-3">
                    <input 
                      type="text" 
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                      placeholder="Especifique outras certificações..." 
                      value={outraCertificacao}
                      onChange={(e) => setOutraCertificacao(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500"><span className="text-red-500">*</span> Campos obrigatórios</p>
            <div className="flex items-center gap-4">
              {isSaved && <span className="text-emerald-600 font-medium text-sm flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Vaga publicada com sucesso!</span>}
              <button type="button" onClick={() => navigate(-1)} className="text-slate-600 px-6 py-2 rounded-lg font-medium hover:bg-slate-100 transition-colors">
                Cancelar
              </button>
              <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-accent transition-colors flex items-center gap-2">
                <Save className="w-4 h-4" /> Publicar Vaga
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function HRCandidatosVaga() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <Link to="/rh/vagas" className="text-slate-500 hover:text-slate-900">
          <Briefcase className="w-5 h-5" />
        </Link>
        <h2 className="text-2xl font-bold text-slate-900">Candidatos: Engenheiro de Produção Sênior</h2>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {['Triagem (45)', 'Entrevista RH (12)', 'Teste Técnico (5)', 'Entrevista Gestor (3)', 'Proposta (1)'].map((stage, index) => (
          <div key={index} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 min-w-[300px] flex-shrink-0">
            <h3 className="font-bold text-slate-900 mb-4">{stage}</h3>
            <div className="space-y-3">
              {[1, 2, 3].map((candidate) => (
                <div key={candidate} className="bg-slate-50 p-3 rounded-lg border border-slate-200 cursor-pointer hover:border-primary transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-slate-900 text-sm">Candidato {candidate}</h4>
                    <span className="text-xs text-slate-500">Há 2 dias</span>
                  </div>
                  <p className="text-xs text-slate-500 mb-2">Engenheiro Químico | 5 anos exp.</p>
                  <div className="flex gap-2">
                    <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-medium">Inglês Avançado</span>
                    <span className="bg-purple-100 text-purple-700 px-2 py-0.5 rounded text-[10px] font-medium">Lean</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HRPlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500">Esta página está em construção.</p>
    </div>
  );
}

export function HRCandidatos() {
  const [selectedVaga, setSelectedVaga] = useState<number | null>(null);
  const [filterEducation, setFilterEducation] = useState('Todos');
  const [selectedCandidates, setSelectedCandidates] = useState<number[]>([]);
  
  // Sorting and filtering state for Vagas table
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  const [candidatos, setCandidatos] = useState([
    { id: 1, vagaId: 1, nome: 'João Silva', formacao: 'Engenharia', status: 'Triagem' },
    { id: 2, vagaId: 1, nome: 'Maria Souza', formacao: 'Administração', status: 'Triagem' },
    { id: 3, vagaId: 2, nome: 'Carlos Pereira', formacao: 'Engenharia', status: 'Entrevista RH' },
    { id: 4, vagaId: 2, nome: 'Ana Costa', formacao: 'Engenharia', status: 'Teste Técnico' },
  ]);

  const vagas = [
    { id: 1, cargo: 'Analista de Qualidade Pleno', criadaEm: '2023-10-25T10:00:00Z', status: 'Aberta', candidaturas: 45 },
    { id: 2, cargo: 'Engenheiro de Produção Sênior', criadaEm: '2023-10-20T14:30:00Z', status: 'Pausada', candidaturas: 12 },
    { id: 3, cargo: 'Técnico de Manutenção', criadaEm: '2023-10-15T09:15:00Z', status: 'Aberta', candidaturas: 89 },
  ];

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
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

  const filteredVagas = vagas.filter(vaga => {
    const matchesSearch = vaga.cargo.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    for (const [key, value] of Object.entries(columnFilters)) {
      if (!value) continue;
      
      let itemValue = String(vaga[key as keyof typeof vaga] || '').toLowerCase();
      if (key === 'criadaEm') {
        itemValue = formatDateTime(vaga.criadaEm).toLowerCase();
      }
      
      if (!itemValue.includes(String(value).toLowerCase())) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any = a[key as keyof typeof a];
    let bValue: any = b[key as keyof typeof b];

    if (key === 'criadaEm') {
      aValue = new Date(a.criadaEm).getTime();
      bValue = new Date(b.criadaEm).getTime();
    } else {
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const renderFilterInput = (key: string, label: string) => {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between cursor-pointer group" onClick={() => handleSort(key)}>
          <span>{label}</span>
          <div className="flex items-center gap-1">
            {renderSortIcon(key)}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterColumn(activeFilterColumn === key ? null : key);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? 'text-primary' : 'text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}
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
            value={columnFilters[key] || ''}
            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-2 py-1 text-xs font-normal border border-slate-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          />
        )}
      </div>
    );
  };

  const filteredCandidatos = selectedVaga 
    ? candidatos.filter(c => c.vagaId === selectedVaga && (filterEducation === 'Todos' || c.formacao === filterEducation))
    : [];

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCandidates(filteredCandidatos.map(c => c.id));
    } else {
      setSelectedCandidates([]);
    }
  };

  const handleSelectCandidate = (id: number) => {
    if (selectedCandidates.includes(id)) {
      setSelectedCandidates(selectedCandidates.filter(cId => cId !== id));
    } else {
      setSelectedCandidates([...selectedCandidates, id]);
    }
  };

  const handleAction = (action: string) => {
    if (selectedCandidates.length === 0) return;
    
    setCandidatos(candidatos.map(c => {
      if (selectedCandidates.includes(c.id)) {
        return { ...c, status: action };
      }
      return c;
    }));
    
    alert(`${action} aplicado a ${selectedCandidates.length} candidatos.`);
    setSelectedCandidates([]);
  };

  if (selectedVaga) {
    const vaga = vagas.find(v => v.id === selectedVaga);
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => { setSelectedVaga(null); setSelectedCandidates([]); }} className="text-slate-500 hover:text-slate-900">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h2 className="text-2xl font-bold text-slate-900">Candidatos: {vaga?.cargo}</h2>
          </div>
          <div className="flex gap-4">
            <select 
              className="bg-white border border-slate-200 text-slate-700 px-4 py-2 rounded-lg text-sm focus:outline-none"
              value={filterEducation}
              onChange={(e) => setFilterEducation(e.target.value)}
            >
              <option value="Todos">Todas as Formações</option>
              <option value="Engenharia">Engenharia</option>
              <option value="Administração">Administração</option>
            </select>
            
            {selectedCandidates.length > 0 && (
              <div className="flex gap-2">
                <button 
                  onClick={() => handleAction('Entrevista RH')}
                  className="bg-emerald-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-emerald-600 transition-colors text-sm"
                >
                  Entrevista RH
                </button>
                <button 
                  onClick={() => handleAction('Backup de Vaga')}
                  className="bg-amber-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-amber-600 transition-colors text-sm"
                >
                  Backup
                </button>
                <button 
                  onClick={() => handleAction('Reprovado')}
                  className="bg-red-500 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-600 transition-colors text-sm"
                >
                  Reprovar
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 w-12">
                  <input 
                    type="checkbox" 
                    checked={selectedCandidates.length === filteredCandidatos.length && filteredCandidatos.length > 0}
                    onChange={handleSelectAll}
                    className="rounded border-slate-300 text-primary focus:ring-primary"
                  />
                </th>
                <th className="px-6 py-4">Nome</th>
                <th className="px-6 py-4">Formação</th>
                <th className="px-6 py-4">Status Atual</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCandidatos.map((candidato) => (
                <tr key={candidato.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <input 
                      type="checkbox" 
                      checked={selectedCandidates.includes(candidato.id)}
                      onChange={() => handleSelectCandidate(candidato.id)}
                      className="rounded border-slate-300 text-primary focus:ring-primary"
                    />
                  </td>
                  <td 
                    className="px-6 py-4 font-medium text-slate-900 cursor-pointer hover:text-primary"
                    onDoubleClick={() => alert(`Detalhes do candidato: ${candidato.nome}\nFormação: ${candidato.formacao}\nStatus: ${candidato.status}`)}
                    title="Duplo clique para ver detalhes"
                  >
                    {candidato.nome}
                  </td>
                  <td className="px-6 py-4">{candidato.formacao}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      candidato.status === 'Reprovado' ? 'bg-red-100 text-red-700' :
                      candidato.status === 'Backup de Vaga' ? 'bg-amber-100 text-amber-700' :
                      candidato.status === 'Entrevista RH' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {candidato.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-primary hover:text-accent font-medium text-sm" onClick={() => alert(`Detalhes do candidato: ${candidato.nome}\nFormação: ${candidato.formacao}\nStatus: ${candidato.status}`)}>Ver Perfil</button>
                  </td>
                </tr>
              ))}
              {filteredCandidatos.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">Nenhum candidato encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Candidatos por Vaga</h2>
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
                <th className="px-6 py-4 w-1/3">{renderFilterInput('cargo', 'Vaga')}</th>
                <th className="px-6 py-4 w-1/4">{renderFilterInput('criadaEm', 'Criada em')}</th>
                <th className="px-6 py-4 w-1/4">{renderFilterInput('status', 'Status')}</th>
                <th className="px-6 py-4 text-center w-1/6">{renderFilterInput('candidaturas', 'Candidatos')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVagas.map((vaga) => (
                <tr 
                  key={vaga.id} 
                  onClick={() => setSelectedVaga(vaga.id)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium text-slate-900">{vaga.cargo}</td>
                  <td className="px-6 py-4">{formatDateTime(vaga.criadaEm)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      vaga.status === 'Aberta' ? 'bg-emerald-100 text-emerald-700' :
                      vaga.status === 'Pausada' ? 'bg-amber-100 text-amber-700' :
                      vaga.status === 'Encerrada' ? 'bg-blue-100 text-blue-700' :
                      'bg-red-100 text-red-700'
                    }`}>
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

export function HREntrevistas() {
  const [selectedVaga, setSelectedVaga] = useState<number | null>(null);

  // Sorting and filtering state for Vagas table
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  const vagas = [
    { id: 1, cargo: 'Analista de Qualidade Pleno', criadaEm: '2023-10-25T10:00:00Z', entrevistas: 5 },
    { id: 2, cargo: 'Engenheiro de Produção Sênior', criadaEm: '2023-10-20T14:30:00Z', entrevistas: 3 },
  ];

  const entrevistas = [
    { id: 1, vagaId: 1, nome: 'João Silva', fase: 'Entrevista RH', status: 'Pendente', observacoes: '' },
    { id: 2, vagaId: 1, nome: 'Maria Souza', fase: 'Entrevista Gestor', status: 'Aprovado', observacoes: 'Ótima comunicação.' },
    { id: 3, vagaId: 2, nome: 'Carlos Pereira', fase: 'Apresentação da Proposta', status: 'Reprovado', observacoes: 'Falta experiência técnica.' },
  ];

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
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

  const filteredVagas = vagas.filter(vaga => {
    const matchesSearch = vaga.cargo.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    for (const [key, value] of Object.entries(columnFilters)) {
      if (!value) continue;
      
      let itemValue = String(vaga[key as keyof typeof vaga] || '').toLowerCase();
      if (key === 'criadaEm') {
        itemValue = formatDateTime(vaga.criadaEm).toLowerCase();
      }
      
      if (!itemValue.includes(String(value).toLowerCase())) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any = a[key as keyof typeof a];
    let bValue: any = b[key as keyof typeof b];

    if (key === 'criadaEm') {
      aValue = new Date(a.criadaEm).getTime();
      bValue = new Date(b.criadaEm).getTime();
    } else {
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const renderFilterInput = (key: string, label: string) => {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between cursor-pointer group" onClick={() => handleSort(key)}>
          <span>{label}</span>
          <div className="flex items-center gap-1">
            {renderSortIcon(key)}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterColumn(activeFilterColumn === key ? null : key);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? 'text-primary' : 'text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}
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
            value={columnFilters[key] || ''}
            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-2 py-1 text-xs font-normal border border-slate-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          />
        )}
      </div>
    );
  };

  const filteredEntrevistas = selectedVaga ? entrevistas.filter(e => e.vagaId === selectedVaga) : [];

  if (selectedVaga) {
    const vaga = vagas.find(v => v.id === selectedVaga);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setSelectedVaga(null)} className="text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Entrevistas: {vaga?.cargo}</h2>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Candidato</th>
                <th className="px-6 py-4">Fase do Processo</th>
                <th className="px-6 py-4">Aprovação</th>
                <th className="px-6 py-4">Comentários</th>
                <th className="px-6 py-4 text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredEntrevistas.map((entrevista) => (
                <tr key={entrevista.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{entrevista.nome}</td>
                  <td className="px-6 py-4">
                    <select className="bg-transparent border-b border-slate-300 focus:outline-none focus:border-primary pb-1" defaultValue={entrevista.fase}>
                      <option value="Entrevista RH">Entrevista RH</option>
                      <option value="Prova">Prova</option>
                      <option value="Entrevista Gestor">Entrevista Gestor</option>
                      <option value="Apresentação da Proposta">Apresentação da Proposta</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <select className="bg-transparent border-b border-slate-300 focus:outline-none focus:border-primary pb-1" defaultValue={entrevista.status}>
                      <option value="Pendente">Pendente</option>
                      <option value="Aprovado">Aprovado</option>
                      <option value="Reprovado">Reprovado</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <input type="text" defaultValue={entrevista.observacoes} placeholder="Adicionar comentário..." className="w-full bg-transparent border-b border-slate-300 focus:outline-none focus:border-primary pb-1" />
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button className="text-primary hover:text-accent font-medium text-sm" onClick={() => alert('Informações salvas com sucesso!')}>Salvar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Entrevistas por Vaga</h2>
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
                <th className="px-6 py-4 w-1/2">{renderFilterInput('cargo', 'Vaga')}</th>
                <th className="px-6 py-4 w-1/4">{renderFilterInput('criadaEm', 'Data de Abertura')}</th>
                <th className="px-6 py-4 text-center w-1/4">{renderFilterInput('entrevistas', 'Candidatos na Fase')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVagas.map((vaga) => (
                <tr 
                  key={vaga.id} 
                  onClick={() => setSelectedVaga(vaga.id)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium text-slate-900">{vaga.cargo}</td>
                  <td className="px-6 py-4">{formatDateTime(vaga.criadaEm)}</td>
                  <td className="px-6 py-4 text-center font-medium text-primary">
                    {vaga.entrevistas}
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

export function HRProvas() {
  const [selectedVaga, setSelectedVaga] = useState<number | null>(null);

  // Sorting and filtering state for Vagas table
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  const vagas = [
    { id: 1, cargo: 'Analista de Qualidade Pleno', candidaturas: 12, dataEnvio: '2023-10-26T10:00:00Z', tipoProva: 'Teste de Excel', exigeProva: true },
    { id: 2, cargo: 'Engenheiro de Produção Sênior', candidaturas: 5, dataEnvio: '2023-10-22T14:30:00Z', tipoProva: 'Case Técnico', exigeProva: true },
    { id: 3, cargo: 'Técnico de Manutenção', candidaturas: 89, dataEnvio: '', tipoProva: '', exigeProva: false },
  ].filter(v => v.exigeProva);

  const provas = [
    { id: 1, vagaId: 1, nome: 'João Silva', teste: 'Teste de Excel', nota: '9', status: 'Aprovado', observacoes: 'Nota 9/10' },
    { id: 2, vagaId: 1, nome: 'Maria Souza', teste: 'Teste de Excel', nota: '4', status: 'Reprovado', observacoes: 'Nota 4/10' },
    { id: 3, vagaId: 2, nome: 'Carlos Pereira', teste: 'Case Técnico', nota: '', status: 'Pendente', observacoes: '' },
  ];

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
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

  const filteredVagas = vagas.filter(vaga => {
    const matchesSearch = vaga.cargo.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    for (const [key, value] of Object.entries(columnFilters)) {
      if (!value) continue;
      
      let itemValue = String(vaga[key as keyof typeof vaga] || '').toLowerCase();
      if (key === 'dataEnvio') {
        itemValue = formatDateTime(vaga.dataEnvio).toLowerCase();
      }
      
      if (!itemValue.includes(String(value).toLowerCase())) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any = a[key as keyof typeof a];
    let bValue: any = b[key as keyof typeof b];

    if (key === 'dataEnvio') {
      aValue = new Date(a.dataEnvio).getTime();
      bValue = new Date(b.dataEnvio).getTime();
    } else {
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const renderFilterInput = (key: string, label: string) => {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between cursor-pointer group" onClick={() => handleSort(key)}>
          <span>{label}</span>
          <div className="flex items-center gap-1">
            {renderSortIcon(key)}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterColumn(activeFilterColumn === key ? null : key);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? 'text-primary' : 'text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}
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
            value={columnFilters[key] || ''}
            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-2 py-1 text-xs font-normal border border-slate-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          />
        )}
      </div>
    );
  };

  const filteredProvas = selectedVaga ? provas.filter(p => p.vagaId === selectedVaga) : [];

  if (selectedVaga) {
    const vaga = vagas.find(v => v.id === selectedVaga);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setSelectedVaga(null)} className="text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Provas: {vaga?.cargo}</h2>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Candidato</th>
                <th className="px-6 py-4">Teste</th>
                <th className="px-6 py-4">Nota</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Observações</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProvas.map((prova) => (
                <tr key={prova.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{prova.nome}</td>
                  <td className="px-6 py-4">{prova.teste}</td>
                  <td className="px-6 py-4">
                    <input type="number" min="0" max="10" step="0.1" defaultValue={prova.nota} placeholder="Ex: 8.5" className="w-20 bg-transparent border-b border-slate-300 focus:outline-none focus:border-primary pb-1" />
                  </td>
                  <td className="px-6 py-4">
                    <select className="bg-transparent border-b border-slate-300 focus:outline-none focus:border-primary pb-1" defaultValue={prova.status}>
                      <option value="Pendente">Pendente</option>
                      <option value="Aprovado">Aprovado</option>
                      <option value="Reprovado">Reprovado</option>
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <input type="text" defaultValue={prova.observacoes} placeholder="Adicionar observação..." className="w-full bg-transparent border-b border-slate-300 focus:outline-none focus:border-primary pb-1" />
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary hover:text-accent font-medium text-sm" onClick={() => alert('Informações salvas com sucesso!')}>Salvar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Provas por Vaga</h2>
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
                <th className="px-6 py-4 w-1/3">{renderFilterInput('cargo', 'Vaga')}</th>
                <th className="px-6 py-4 text-center w-1/6">{renderFilterInput('candidaturas', 'Candidatos')}</th>
                <th className="px-6 py-4 w-1/4">{renderFilterInput('dataEnvio', 'Data de Envio da Prova')}</th>
                <th className="px-6 py-4 w-1/4">{renderFilterInput('tipoProva', 'Prova (Tipo)')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVagas.map((vaga) => (
                <tr 
                  key={vaga.id} 
                  onClick={() => setSelectedVaga(vaga.id)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium text-slate-900">{vaga.cargo}</td>
                  <td className="px-6 py-4 text-center font-medium text-primary">
                     {vaga.candidaturas}
                  </td>
                  <td className="px-6 py-4">{formatDateTime(vaga.dataEnvio)}</td>
                  <td className="px-6 py-4">{vaga.tipoProva}</td>
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
  const [selectedVaga, setSelectedVaga] = useState<number | null>(null);
  const [selectedCandidate, setSelectedCandidate] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  // Sorting and filtering state for Vagas table
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);

  const vagas = [
    { id: 1, cargo: 'Analista de Qualidade Pleno', candidaturas: 45, aptos: 5, criadaEm: '2023-10-26T10:00:00Z', status: 'Aberta' },
    { id: 2, cargo: 'Engenheiro de Produção Sênior', candidaturas: 12, aptos: 2, criadaEm: '2023-10-22T14:30:00Z', status: 'Pausada' },
  ];

  const candidatos = [
    { id: 1, vagaId: 1, nome: 'João Silva', email: 'joao.silva@email.com' },
    { id: 2, vagaId: 1, nome: 'Maria Souza', email: 'maria.souza@email.com' },
    { id: 3, vagaId: 2, nome: 'Carlos Pereira', email: 'carlos.pereira@email.com' },
  ];

  const chatHistory = [
    { id: 1, sender: 'hr', text: 'Olá João, gostaríamos de agendar uma entrevista.', time: '10:00 AM' },
    { id: 2, sender: 'candidate', text: 'Olá! Claro, qual seria o melhor horário?', time: '10:15 AM' },
  ];

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric', 
      hour: '2-digit', minute: '2-digit' 
    });
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

  const filteredVagas = vagas.filter(vaga => {
    const matchesSearch = vaga.cargo.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;

    for (const [key, value] of Object.entries(columnFilters)) {
      if (!value) continue;
      
      let itemValue = String(vaga[key as keyof typeof vaga] || '').toLowerCase();
      if (key === 'criadaEm') {
        itemValue = formatDateTime(vaga.criadaEm).toLowerCase();
      }
      
      if (!itemValue.includes(String(value).toLowerCase())) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any = a[key as keyof typeof a];
    let bValue: any = b[key as keyof typeof b];

    if (key === 'criadaEm') {
      aValue = new Date(a.criadaEm).getTime();
      bValue = new Date(b.criadaEm).getTime();
    } else {
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const renderFilterInput = (key: string, label: string) => {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between cursor-pointer group" onClick={() => handleSort(key)}>
          <span>{label}</span>
          <div className="flex items-center gap-1">
            {renderSortIcon(key)}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterColumn(activeFilterColumn === key ? null : key);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? 'text-primary' : 'text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}
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
            value={columnFilters[key] || ''}
            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-2 py-1 text-xs font-normal border border-slate-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          />
        )}
      </div>
    );
  };

  const filteredCandidatos = selectedVaga ? candidatos.filter(c => c.vagaId === selectedVaga) : [];

  const handleSendMessage = () => {
    if (!message.trim() || !selectedCandidate) return;
    
    const candidato = candidatos.find(c => c.id === selectedCandidate);
    
    // Simulate sending email
    console.log(`
      [SIMULAÇÃO DE EMAIL]
      Para: ${candidato?.email}
      Assunto: Nova mensagem sobre o processo seletivo
      
      Olá ${candidato?.nome},
      
      Você recebeu uma nova mensagem da equipe de Recursos Humanos referente ao seu processo seletivo.
      
      Mensagem: "${message}"
      
      Por favor, acesse a plataforma para responder.
      
      Atenciosamente,
      Equipe de RH
    `);

    alert(`Mensagem enviada e notificação por e-mail disparada para ${candidato?.nome}!`);
    setMessage('');
  };

  if (selectedCandidate) {
    const candidato = candidatos.find(c => c.id === selectedCandidate);
    return (
      <div className="space-y-6 flex flex-col h-[calc(100vh-12rem)]">
        <div className="flex items-center gap-4 mb-2">
          <button onClick={() => setSelectedCandidate(null)} className="text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Chat: {candidato?.nome}</h2>
        </div>
        
        <div className="flex-1 bg-white rounded-xl shadow-sm border border-slate-200 flex flex-col overflow-hidden">
          <div className="flex-1 p-6 overflow-y-auto space-y-4">
            {chatHistory.map(msg => (
              <div key={msg.id} className={`flex flex-col ${msg.sender === 'hr' ? 'items-end' : 'items-start'}`}>
                <div className={`max-w-[80%] rounded-2xl p-4 ${msg.sender === 'hr' ? 'bg-primary text-white rounded-tr-sm' : 'bg-slate-100 text-slate-800 rounded-tl-sm'}`}>
                  <p>{msg.text}</p>
                </div>
                <span className="text-xs text-slate-400 mt-1">{msg.time}</span>
              </div>
            ))}
          </div>
          <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-4">
            <input 
              type="text" 
              placeholder="Digite sua mensagem..." 
              className="flex-1 px-4 py-2 rounded-lg border border-slate-300 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <button onClick={handleSendMessage} className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-accent transition-colors">
              Enviar
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (selectedVaga) {
    const vaga = vagas.find(v => v.id === selectedVaga);
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setSelectedVaga(null)} className="text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-2xl font-bold text-slate-900">Mensagens: {vaga?.cargo}</h2>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-slate-700 uppercase font-medium border-b border-slate-200">
              <tr>
                <th className="px-6 py-4">Candidato</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredCandidatos.map((candidato) => (
                <tr key={candidato.id} className="hover:bg-slate-50 transition-colors cursor-pointer" onClick={() => setSelectedCandidate(candidato.id)}>
                  <td className="px-6 py-4 font-medium text-slate-900">{candidato.nome}</td>
                  <td className="px-6 py-4 text-right">
                    <button className="text-primary hover:text-accent font-medium text-sm flex items-center justify-end gap-2 w-full">
                      <MessageSquare className="w-4 h-4" /> Abrir Chat
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-slate-900">Mensagens por Vaga</h2>
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
                <th className="px-6 py-4 w-1/3">{renderFilterInput('cargo', 'Vaga')}</th>
                <th className="px-6 py-4 w-1/6">{renderFilterInput('criadaEm', 'Data de Abertura')}</th>
                <th className="px-6 py-4 w-1/6">{renderFilterInput('status', 'Status')}</th>
                <th className="px-6 py-4 text-center w-1/6">{renderFilterInput('aptos', 'Candidatos Aptos')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredVagas.map((vaga) => (
                <tr 
                  key={vaga.id} 
                  onClick={() => setSelectedVaga(vaga.id)}
                  className="hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  <td className="px-6 py-4 font-medium text-slate-900">{vaga.cargo}</td>
                  <td className="px-6 py-4">{formatDateTime(vaga.criadaEm)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      vaga.status === 'Aberta' ? 'bg-emerald-100 text-emerald-700' :
                      vaga.status === 'Pausada' ? 'bg-amber-100 text-amber-700' :
                      vaga.status === 'Encerrada' ? 'bg-slate-100 text-slate-700' :
                      'bg-red-100 text-red-700'
                    }`}>
                      {vaga.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center font-medium text-primary">
                    {vaga.aptos}
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

export function HRBancoTalentos() {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [columnFilters, setColumnFilters] = useState<{ [key: string]: string }>({});
  const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
  
  const [isAssociarModalOpen, setIsAssociarModalOpen] = useState(false);
  const [selectedTalentoId, setSelectedTalentoId] = useState<number | null>(null);
  const [selectedVagaToAssociate, setSelectedVagaToAssociate] = useState<number | null>(null);

  const vagasAbertas = [
    { id: 1, cargo: 'Analista de Qualidade Pleno' },
    { id: 3, cargo: 'Técnico de Manutenção' },
  ];
  
  const talentos = [
    { id: 1, nome: 'João Silva', email: 'joao.silva@email.com', formacao: 'Engenharia de Produção', areaInteresse: 'Engenharia', experiencia: 5, dataCadastro: '2023-09-15T10:00:00Z', status: 'Disponível' },
    { id: 2, nome: 'Maria Souza', email: 'maria.souza@email.com', formacao: 'Administração', areaInteresse: 'Financeiro', experiencia: 3, dataCadastro: '2023-10-01T14:30:00Z', status: 'Em Processo' },
    { id: 3, nome: 'Carlos Pereira', email: 'carlos.pereira@email.com', formacao: 'Técnico em Mecânica', areaInteresse: 'Manutenção', experiencia: 8, dataCadastro: '2023-10-10T09:15:00Z', status: 'Disponível' },
  ];

  const formatDateTime = (isoString: string) => {
    if (!isoString) return '-';
    const date = new Date(isoString);
    return date.toLocaleString('pt-BR', { 
      day: '2-digit', month: '2-digit', year: 'numeric'
    });
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

  const filteredTalentos = talentos.filter(talento => {
    const matchesSearch = 
      talento.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      talento.formacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
      talento.areaInteresse.toLowerCase().includes(searchTerm.toLowerCase());
      
    if (!matchesSearch) return false;

    for (const [key, value] of Object.entries(columnFilters)) {
      if (!value) continue;
      
      let itemValue = String(talento[key as keyof typeof talento] || '').toLowerCase();
      if (key === 'dataCadastro') {
        itemValue = formatDateTime(talento.dataCadastro).toLowerCase();
      }
      
      if (!itemValue.includes(String(value).toLowerCase())) {
        return false;
      }
    }
    return true;
  }).sort((a, b) => {
    if (!sortConfig) return 0;
    const { key, direction } = sortConfig;
    
    let aValue: any = a[key as keyof typeof a];
    let bValue: any = b[key as keyof typeof b];

    if (key === 'dataCadastro') {
      aValue = new Date(a.dataCadastro).getTime();
      bValue = new Date(b.dataCadastro).getTime();
    } else if (key === 'experiencia') {
      aValue = Number(aValue);
      bValue = Number(bValue);
    } else {
      aValue = String(aValue).toLowerCase();
      bValue = String(bValue).toLowerCase();
    }

    if (aValue < bValue) return direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return direction === 'asc' ? 1 : -1;
    return 0;
  });

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) {
      return <ArrowUpDown className="w-3 h-3 text-slate-400" />;
    }
    return sortConfig.direction === 'asc' 
      ? <ArrowUp className="w-3 h-3 text-primary" />
      : <ArrowDown className="w-3 h-3 text-primary" />;
  };

  const renderFilterInput = (key: string, label: string) => {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between cursor-pointer group" onClick={() => handleSort(key)}>
          <span>{label}</span>
          <div className="flex items-center gap-1">
            {renderSortIcon(key)}
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setActiveFilterColumn(activeFilterColumn === key ? null : key);
              }}
              className={`p-1 rounded hover:bg-slate-200 ${columnFilters[key] ? 'text-primary' : 'text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity'}`}
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
            value={columnFilters[key] || ''}
            onChange={(e) => handleColumnFilterChange(key, e.target.value)}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 px-2 py-1 text-xs font-normal border border-slate-300 rounded focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary w-full"
          />
        )}
      </div>
    );
  };

  const handleOpenAssociarModal = (id: number) => {
    setSelectedTalentoId(id);
    setIsAssociarModalOpen(true);
  };

  const handleConfirmarAssociacao = () => {
    if (!selectedVagaToAssociate || !selectedTalentoId) return;
    
    const talento = talentos.find(t => t.id === selectedTalentoId);
    const vaga = vagasAbertas.find(v => v.id === selectedVagaToAssociate);
    
    console.log(`
      [SIMULAÇÃO DE EMAIL]
      Para: ${talento?.email}
      Assunto: Convite para Processo Seletivo - ${vaga?.cargo}
      
      Olá ${talento?.nome},
      
      Avaliamos o seu perfil em nosso Banco de Talentos e identificamos que suas habilidades estão alinhadas com a nossa vaga de ${vaga?.cargo}.
      
      Gostaríamos de convidá-lo(a) para participar do processo seletivo!
      
      Para confirmar sua participação, por favor, acesse a nossa plataforma utilizando o link abaixo e candidate-se formalmente à vaga.
      
      [Link para a vaga]
      
      Aguardamos a sua candidatura.
      
      Atenciosamente,
      Equipe de RH
    `);

    alert(`Candidato associado à vaga e convite enviado por e-mail para ${talento?.nome}!`);
    setIsAssociarModalOpen(false);
    setSelectedTalentoId(null);
    setSelectedVagaToAssociate(null);
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
                <th className="px-6 py-4 w-1/5">{renderFilterInput('nome', 'Nome')}</th>
                <th className="px-6 py-4 w-1/6">{renderFilterInput('email', 'E-mail')}</th>
                <th className="px-6 py-4 w-1/6">{renderFilterInput('formacao', 'Formação')}</th>
                <th className="px-6 py-4 w-1/6">{renderFilterInput('areaInteresse', 'Área de Interesse')}</th>
                <th className="px-6 py-4 w-1/12">{renderFilterInput('experiencia', 'Exp. (Anos)')}</th>
                <th className="px-6 py-4 w-1/12">{renderFilterInput('dataCadastro', 'Cadastro')}</th>
                <th className="px-6 py-4 w-1/12">{renderFilterInput('status', 'Status')}</th>
                <th className="px-6 py-4 text-right w-1/12">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredTalentos.map((talento) => (
                <tr key={talento.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-900">{talento.nome}</td>
                  <td className="px-6 py-4">{talento.email}</td>
                  <td className="px-6 py-4">{talento.formacao}</td>
                  <td className="px-6 py-4">{talento.areaInteresse}</td>
                  <td className="px-6 py-4 text-center">{talento.experiencia}</td>
                  <td className="px-6 py-4">{formatDateTime(talento.dataCadastro)}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      talento.status === 'Disponível' ? 'bg-emerald-100 text-emerald-700' :
                      talento.status === 'Em Processo' ? 'bg-amber-100 text-amber-700' :
                      'bg-blue-100 text-blue-700'
                    }`}>
                      {talento.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button onClick={() => handleOpenAssociarModal(talento.id)} className="text-primary hover:text-accent font-medium text-xs border border-primary px-2 py-1 rounded">
                        Associar à Vaga
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredTalentos.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-500">Nenhum talento encontrado.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Associar Vaga */}
      {isAssociarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <h3 className="text-xl font-bold text-slate-900 mb-4">Associar a uma Vaga em Aberto</h3>
            <p className="text-slate-600 mb-4 text-sm">
              Selecione a vaga para a qual deseja convidar o candidato. Um e-mail será enviado com as instruções para candidatura.
            </p>
            
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vaga</label>
                <select 
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  value={selectedVagaToAssociate || ''}
                  onChange={(e) => setSelectedVagaToAssociate(Number(e.target.value))}
                >
                  <option value="" disabled>Selecione uma vaga...</option>
                  {vagasAbertas.map(vaga => (
                    <option key={vaga.id} value={vaga.id}>{vaga.cargo}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button 
                onClick={() => {
                  setIsAssociarModalOpen(false);
                  setSelectedVagaToAssociate(null);
                }}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                onClick={handleConfirmarAssociacao}
                disabled={!selectedVagaToAssociate}
                className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Associar e Enviar Convite
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
