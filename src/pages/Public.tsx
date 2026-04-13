import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Search, MapPin, Briefcase, ChevronRight, CheckCircle2, Globe, Calendar, Users, FlaskConical, Award, Leaf, Building2, Rocket, ExternalLink, Eye, EyeOff, DollarSign, Database, Trash2, Plus, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { logAudit } from '../lib/audit';
import { logCandidaturaEvento } from '../lib/events';
import { useAuth } from '../contexts/AuthContext';
import { seedDatabase } from '../lib/seed';

export function Home() {
  // [EDITABLE_START:public_home_state]
  const { user } = useAuth();
  const [vagasAbertas, setVagasAbertas] = useState(0);
  const [vagasDestaque, setVagasDestaque] = useState<any[]>([]);
  // [EDITABLE_END:public_home_state]

  // [EDITABLE_START:public_home_useeffect_init]
  useEffect(() => {
    const fetchVagas = async () => {
      try {
        const { data, count, error } = await supabase
          .from('vagas')
          .select('*', { count: 'exact' })
          .eq('status_vaga', 'ABERTA')
          .limit(3);

        if (error) throw error;
        
        let finalVagas = data || [];

        if (user && finalVagas.length > 0) {
          const { data: candidaturas } = await supabase
            .from('candidaturas')
            .select('vaga_id')
            .eq('candidato_id', user.id)
            .in('vaga_id', finalVagas.map(v => v.id));

          if (candidaturas) {
            const appliedIds = new Set(candidaturas.map(c => c.vaga_id));
            finalVagas = finalVagas.map(v => ({
              ...v,
              ja_candidatado: appliedIds.has(v.id)
            }));
          }
        }

        setVagasAbertas(count || 0);
        setVagasDestaque(finalVagas);
      } catch (error) {
        console.error('Erro ao buscar vagas:', error);
      }
    };
    fetchVagas();
  }, [user]);
  // [EDITABLE_END:public_home_useeffect_init]

  return (
    <div>
      {/* Hero Section */}
      <section className="bg-[#0B1B3D] text-white py-32 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B1B3D] to-[#0A1526]"></div>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10">
          
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-blue-500/30 bg-blue-500/10 text-blue-300 text-sm font-medium mb-8">
            <Briefcase className="w-4 h-4" />
            {vagasAbertas} vagas abertas
          </div>

          <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-tight">
            Construa o futuro da <br className="hidden md:block" />
            <span className="text-[#00b4d8]">sua carreira</span>
          </h1>
          
          <p className="text-lg md:text-xl text-slate-300 mb-12 max-w-3xl mx-auto font-light leading-relaxed">
            A DFL é líder nacional em anestésicos odontológicos e referência global em produtos farmacêuticos. Junte-se a uma empresa presente em mais de 45 países e construa uma carreira de impacto.
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/vagas" className="w-full sm:w-auto bg-[#3b82f6] hover:bg-[#2563eb] text-white px-8 py-3.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 shadow-lg shadow-blue-500/25">
              Ver vagas abertas <ChevronRight className="w-5 h-5" />
            </Link>
            <Link to="/cadastro" className="w-full sm:w-auto bg-[#00b4d8] hover:bg-[#0096b4] text-white px-8 py-3.5 rounded-lg font-medium transition-colors shadow-lg shadow-cyan-500/25">
              Cadastre-se
            </Link>
          </div>
        </div>
      </section>

      {/* Vagas em Destaque */}
      {vagasDestaque.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-end mb-10">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 tracking-tight">Vagas em destaque</h2>
                <p className="text-slate-600 mt-2">Encontre a oportunidade perfeita para o seu perfil.</p>
              </div>
              <Link to="/vagas" className="text-primary font-medium hover:underline flex items-center gap-1">
                Ver todas <ChevronRight className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {vagasDestaque.map((vaga) => (
                <div key={vaga.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-primary/5 rounded-lg text-primary">
                      <Briefcase className="w-6 h-6" />
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
                        Novo
                      </span>
                      {vaga.codigo_vaga && (
                        <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                          {vaga.codigo_vaga}
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">{vaga.titulo}</h3>
                  <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {vaga.local || 'Não especificado'}</span>
                    <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {vaga.tipo || 'Não especificado'}</span>
                    {vaga.salario && (
                      <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> {vaga.salario}</span>
                    )}
                  </div>
                  <Link 
                    to={`/vagas/${vaga.id}`} 
                    className={`block w-full text-center font-medium py-2 rounded-lg transition-colors border ${
                      vaga.ja_candidatado 
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                        : 'bg-slate-50 text-primary border-slate-200 hover:bg-primary hover:text-white hover:border-primary'
                    }`}
                  >
                    {vaga.ja_candidatado ? 'Já se candidatou' : 'Ver Detalhes'}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

export function ListaVagas() {
  // [EDITABLE_START:public_listavagas_state]
  const { user } = useAuth();
  const [vagas, setVagas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  // [EDITABLE_END:public_listavagas_state]

  // [EDITABLE_START:public_listavagas_useeffect_init]
  useEffect(() => {
    const fetchVagas = async () => {
      try {
        const { data, error } = await supabase
          .from('vagas')
          .select('*')
          .eq('status_vaga', 'ABERTA');

        if (error) throw error;
        
        let finalVagas = data || [];

        if (user && finalVagas.length > 0) {
          const { data: candidaturas } = await supabase
            .from('candidaturas')
            .select('vaga_id')
            .eq('candidato_id', user.id);

          if (candidaturas) {
            const appliedIds = new Set(candidaturas.map(c => c.vaga_id));
            finalVagas = finalVagas.map(v => ({
              ...v,
              ja_candidatado: appliedIds.has(v.id)
            }));
          }
        }

        setVagas(finalVagas);
      } catch (error) {
        console.error('Erro ao buscar vagas:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVagas();
  }, [user]);
  // [EDITABLE_END:public_listavagas_useeffect_init]

  const filteredVagas = vagas.filter(vaga => {
    const matchesSearch = vaga.titulo?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          vaga.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesLocation = locationFilter ? vaga.local?.toLowerCase().includes(locationFilter.toLowerCase()) : true;
    return matchesSearch && matchesLocation;
  });

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-8">Vagas Abertas</h1>
        
        {/* Search Bar */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text" 
              placeholder="Buscar por cargo ou palavra-chave..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="w-full md:w-64 relative">
            <MapPin className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select 
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none bg-white"
            >
              <option value="">Todas as localidades</option>
              <option value="rio de janeiro">Rio de Janeiro, RJ</option>
              <option value="são paulo">São Paulo, SP</option>
              <option value="remoto">Remoto</option>
            </select>
          </div>
        </div>

        {/* List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12 text-slate-500">Carregando vagas...</div>
          ) : filteredVagas.length === 0 ? (
            <div className="text-center py-12 text-slate-500">Nenhuma vaga encontrada com os filtros atuais.</div>
          ) : (
            filteredVagas.map((vaga) => (
              <div key={vaga.id} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-lg font-bold text-slate-900">{vaga.titulo}</h3>
                    {vaga.codigo_vaga && (
                      <span className="text-xs font-mono text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                        {vaga.codigo_vaga}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                    <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> {vaga.local || 'Não especificado'}</span>
                    <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> {vaga.tipo || 'Não especificado'}</span>
                    {vaga.salario && (
                      <span className="flex items-center gap-1"><DollarSign className="w-4 h-4" /> {vaga.salario}</span>
                    )}
                    {vaga.departamento && (
                      <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">{vaga.departamento}</span>
                    )}
                  </div>
                </div>
                <Link 
                  to={`/vagas/${vaga.id}`} 
                  className={`shrink-0 font-medium px-6 py-2 rounded-lg transition-colors border text-center ${
                    vaga.ja_candidatado 
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' 
                      : 'bg-slate-50 text-primary border-slate-200 hover:bg-primary hover:text-white hover:border-primary'
                  }`}
                >
                  {vaga.ja_candidatado ? 'Já se candidatou' : 'Ver Detalhes'}
                </Link>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function DetalheVaga() {
  // [EDITABLE_START:public_detalhevaga_state]
  const { user, profile } = useAuth();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error' | 'login' | 'applyForm'>('success');
  const [vaga, setVaga] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isApplying, setIsApplying] = useState(false);
  const [jaCandidatado, setJaCandidatado] = useState(false);
  const [comoSoube, setComoSoube] = useState('');
  const [indicacaoNome, setIndicacaoNome] = useState('');

  console.log('>>> DetalheVaga RENDER', { showModal, modalType, comoSoube, isApplying, jaCandidatado });
  // [EDITABLE_END:public_detalhevaga_state]

  // [EDITABLE_START:public_detalhevaga_useeffect_init]
  useEffect(() => {
    const fetchVaga = async () => {
      if (!id) return;
      try {
        const { data, error } = await supabase
          .from('vagas')
          .select('*')
          .eq('id', id)
          .single();

        if (error) throw error;
        setVaga(data);

        // Check if user already applied
        if (user) {
          const { data: existing } = await supabase
            .from('candidaturas')
            .select('id')
            .eq('vaga_id', id)
            .eq('candidato_id', user.id)
            .maybeSingle();
          
          if (existing) {
            setJaCandidatado(true);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar vaga:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchVaga();
  }, [id, user]);
  // [EDITABLE_END:public_detalhevaga_useeffect_init]

  // [EDITABLE_START:public_detalhevaga_handlers]
  const handleApply = async () => {
    console.log('handleApply chamado', { status_vaga: vaga?.status_vaga, user: user?.id, profile: profile?.perfil });
    if (vaga?.status_vaga !== 'ABERTA') {
      alert('Esta vaga não está disponível para candidatura');
      return;
    }

    if (!user) {
      setModalType('login');
      setShowModal(true);
      return;
    }

    // Check if user is a candidate
    if (!profile || profile.perfil !== 'Candidato') {
      alert('Apenas candidatos podem se candidatar a vagas.');
      return;
    }

    // Check if resume is completed
    const isResumeCompleted = profile.resume_completed === true || localStorage.getItem('resumeCompleted') === 'true';
    
    if (!isResumeCompleted) {
      setModalType('error');
      setShowModal(true);
      return;
    }

    // If everything is okay, show the apply form modal
    setModalType('applyForm');
    setShowModal(true);
  };

  const confirmApply = async () => {
    console.log('>>> confirmApply INICIADO', { 
      comoSoube, 
      indicacaoNome, 
      id, 
      userId: user?.id,
      isApplying 
    });

    if (!comoSoube) {
      alert('Por favor, informe como soube da vaga.');
      return;
    }

    if (comoSoube === 'Indicação de colaborador' && !indicacaoNome.trim()) {
      alert('Por favor, informe o nome do colaborador que indicou.');
      return;
    }

    if (isApplying) {
      return;
    }

    try {
      setIsApplying(true);
      console.log('>>> PASSO: Validando vaga no Supabase...');

      // 1. Antes de criar candidatura: Buscar vaga pelo id
      const { data: currentVaga, error: vagaError } = await supabase
        .from('vagas')
        .select('status_vaga, titulo')
        .eq('id', id)
        .single();
      
      if (vagaError || !currentVaga) {
        console.error('Erro ao validar vaga:', vagaError);
        throw new Error('Erro ao validar vaga.');
      }

      console.log('Vaga validada:', currentVaga);

      // 2. Validar: Se status_vaga != 'ABERTA'
      if (currentVaga.status_vaga !== 'ABERTA') {
        alert('Esta vaga não está disponível para candidatura');
        setIsApplying(false);
        setShowModal(false);
        return;
      }

      // Check if already applied
      console.log('Verificando candidatura existente...');
      const { data: existing, error: checkError } = await supabase
        .from('candidaturas')
        .select('id')
        .eq('vaga_id', id)
        .eq('candidato_id', user?.id)
        .maybeSingle();
      
      if (checkError) {
        console.error('Erro ao verificar candidatura existente:', checkError);
        throw checkError;
      }
      
      if (existing) {
        alert('Você já se candidatou a esta vaga.');
        setShowModal(false);
        return;
      }

      console.log('Preparando dados da candidatura...');
      const candidaturaData = {
        vaga_id: id,
        candidato_id: user?.id,
        fase: 'Triagem',
        visualizado: false,
        origem: comoSoube,
        como_soube: comoSoube, // Mantendo ambos por segurança se a coluna existir
        indicacao_nome: comoSoube === 'Indicação de colaborador' ? indicacaoNome : '',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        data_candidatura: new Date().toISOString()
      };

      console.log('Inserindo candidatura...', candidaturaData);
      const { data: newCand, error: insertError } = await supabase
        .from('candidaturas')
        .insert(candidaturaData)
        .select()
        .single();

      if (insertError) {
        console.error('Erro no insert da candidatura:', insertError);
        throw insertError;
      }
      
      console.log('Candidatura inserida com sucesso!');
      
      // Log action in audit
      await logAudit('Candidatou-se', 'Portal do Candidato', `Candidatou-se à vaga ${currentVaga.titulo}`);

      // Log action in candidacy history
      if (newCand) {
        await logCandidaturaEvento(
          newCand.id,
          'FASE',
          'Candidatura iniciada na fase de Triagem',
          user?.id
        );
      }

      // Enviar e-mail de confirmação
      try {
        const { data: configData } = await supabase
          .from('settings')
          .select('*')
          .eq('id', 'email')
          .single();
        
        if (configData) {
          const settings = configData.data || configData;
          if (settings.smtpHost && settings.smtpUser && settings.smtpPass && user?.email) {
            const subject = `Confirmação de Candidatura - ${currentVaga.titulo}`;
            const body = `Olá ${user?.user_metadata?.nome || 'Candidato'},\n\nSua candidatura para a vaga "${currentVaga.titulo}" foi recebida com sucesso!\n\nFique atento ao seu portal para acompanhar as próximas etapas.\n\nAtenciosamente,\nEquipe de RH`;
            
            const response = await fetch('/api/send-email', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                to: user.email,
                subject,
                body,
                smtpConfig: {
                  smtpHost: settings.smtpHost,
                  smtpPort: settings.smtpPort,
                  smtpUser: settings.smtpUser,
                  smtpPass: settings.smtpPass
                }
              })
            });
            
            if (response.ok) {
              console.log('E-mail de confirmação enviado com sucesso.');
            } else {
              const errorData = await response.json();
              console.warn('Falha ao enviar e-mail de confirmação:', errorData.message);
            }
          }
        }
      } catch (emailErr) {
        console.error('Erro ao enviar e-mail de confirmação:', emailErr);
      }

      setModalType('success');
      setShowModal(true);
    } catch (error: any) {
      console.error('Erro fatal ao se candidatar:', error);
      alert(`Erro ao realizar candidatura: ${error.message || 'Tente novamente.'}`);
    } finally {
      setIsApplying(false);
    }
  };
  // [EDITABLE_END:public_detalhevaga_handlers]

  if (loading) return <div className="py-12 text-center">Carregando detalhes da vaga...</div>;
  if (!vaga) return <div className="py-12 text-center">Vaga não encontrada.</div>;

  const isDashboard = location.pathname.startsWith('/candidato') || location.pathname.startsWith('/rh') || location.pathname.startsWith('/admin');

  return (
    <div className={`${isDashboard ? '' : 'py-12 bg-slate-50 min-h-screen'}`}>
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
            {modalType === 'success' ? (
              <>
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Candidatura Realizada!</h3>
                <p className="text-slate-600 mb-6">Sua candidatura para {vaga.titulo} foi enviada com sucesso.</p>
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  Fechar
                </button>
              </>
            ) : modalType === 'login' ? (
              <>
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Login Necessário</h3>
                <p className="text-slate-600 mb-6">Você precisa estar logado como candidato para se candidatar.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => navigate('/login')}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                  >
                    Fazer Login
                  </button>
                </div>
              </>
            ) : modalType === 'applyForm' ? (
              <div className="text-left">
                <h3 className="text-xl font-bold text-slate-900 mb-4">Finalizar Candidatura</h3>
                <p className="text-sm text-slate-600 mb-6">Por favor, responda à pergunta abaixo para concluir sua candidatura para <strong>{vaga.titulo}</strong>.</p>
                
                <div className="space-y-4 mb-8">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Como soube da vaga? <span className="text-red-500">*</span></label>
                    <select 
                      value={comoSoube} 
                      onChange={(e) => {
                        console.log('>>> SELECT ALTERADO:', e.target.value);
                        setComoSoube(e.target.value);
                      }}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                    >
                      <option value="">Selecione uma opção</option>
                      <option value="LinkedIn">LinkedIn</option>
                      <option value="Site da Empresa">Site da Empresa</option>
                      <option value="Indicação de colaborador">Indicação de colaborador</option>
                      <option value="Outros">Outros</option>
                    </select>
                  </div>

                  {comoSoube === 'Indicação de colaborador' && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-200">
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome de quem indicou <span className="text-red-500">*</span></label>
                      <input 
                        type="text" 
                        value={indicacaoNome}
                        onChange={(e) => setIndicacaoNome(e.target.value)}
                        placeholder="Informe o nome completo"
                        className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => {
                      confirmApply();
                    }}
                    disabled={isApplying || !comoSoube || (comoSoube === 'Indicação de colaborador' && !indicacaoNome.trim())}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50"
                  >
                    {isApplying ? 'Processando...' : 'Confirmar'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Currículo Incompleto</h3>
                <p className="text-slate-600 mb-6">Para se candidatar a esta vaga, você precisa preencher todas as informações obrigatórias do seu currículo.</p>
                <div className="flex gap-3">
                  <button 
                    onClick={() => setShowModal(false)}
                    className="flex-1 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={() => navigate('/candidato/curriculo')}
                    className="flex-1 bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                  >
                    Preencher Currículo
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <button onClick={() => navigate(-1)} className="text-primary font-medium hover:underline flex items-center gap-1 mb-6">
          <ChevronRight className="w-4 h-4 rotate-180" /> Voltar
        </button>
        
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-8 border-b border-slate-200">
            <div className="flex justify-between items-start gap-4 mb-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{vaga.titulo}</h1>
                {vaga.codigo_vaga && (
                  <span className="inline-block mt-2 text-sm font-mono text-slate-500 bg-slate-100 px-2 py-1 rounded">
                    Código: {vaga.codigo_vaga}
                  </span>
                )}
              </div>
              {jaCandidatado ? (
                <div className="shrink-0 bg-emerald-100 text-emerald-700 px-8 py-3 rounded-lg font-medium flex items-center gap-2 border border-emerald-200">
                  <CheckCircle2 className="w-5 h-5" /> Já se candidatou
                </div>
              ) : vaga.status_vaga === 'ABERTA' ? (
                <button 
                  onClick={handleApply} 
                  disabled={isApplying}
                  className="shrink-0 bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50"
                >
                  {isApplying ? 'Processando...' : 'Candidatar-se'}
                </button>
              ) : (
                <div className="shrink-0 bg-slate-100 text-slate-500 px-8 py-3 rounded-lg font-medium cursor-not-allowed">
                  Vaga {vaga.status_vaga || vaga.status}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <span className="flex items-center gap-2"><MapPin className="w-5 h-5 text-slate-400" /> {vaga.local || 'Não especificado'}</span>
              <span className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-slate-400" /> {vaga.tipo || 'Não especificado'}</span>
              {vaga.salario && (
                <span className="flex items-center gap-2"><DollarSign className="w-5 h-5 text-slate-400" /> {vaga.salario}</span>
              )}
              {vaga.departamento && (
                <span className="flex items-center gap-2"><Building2 className="w-5 h-5 text-slate-400" /> {vaga.departamento}</span>
              )}
            </div>
          </div>
          
          <div className="p-8 prose prose-slate max-w-none">
            <h3 className="text-lg font-bold mb-2">Descrição da Vaga</h3>
            <p className="whitespace-pre-wrap mb-6">{vaga.descricao}</p>
            
            {vaga.requisitos && (
              <>
                <h3 className="text-lg font-bold mb-2">Requisitos</h3>
                <p className="whitespace-pre-wrap mb-6">{vaga.requisitos}</p>
              </>
            )}

            {vaga.beneficios && (
              <>
                <h3 className="text-lg font-bold mb-2">Benefícios</h3>
                <p className="whitespace-pre-wrap mb-6">{vaga.beneficios}</p>
              </>
            )}

            {vaga.salario && (
              <>
                <h3 className="text-lg font-bold mb-2">Faixa Salarial</h3>
                <p className="mb-6">{vaga.salario}</p>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function Cadastro() {
  // [EDITABLE_START:public_cadastro_state]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();

  const [formData, setFormData] = useState({
    nome: '',
    login: '',
    email: '',
    senha: '',
    confirmarSenha: ''
  });
  // [EDITABLE_END:public_cadastro_state]

  // [EDITABLE_START:public_cadastro_useeffect_redirect]
  useEffect(() => {
    if (!authLoading && user && profile && user.email_confirmed_at) {
      const p = profile.perfil?.toLowerCase();
      if (p === 'admin') navigate('/admin');
      else if (p === 'rh') navigate('/rh');
      else navigate('/candidato');
    }
  }, [user, profile, authLoading, navigate]);
  // [EDITABLE_END:public_cadastro_useeffect_redirect]

  // [EDITABLE_START:public_cadastro_handle_submit]
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.senha !== formData.confirmarSenha) {
      setError('As senhas não coincidem.');
      return;
    }

    if (formData.senha.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.senha,
        options: {
          data: {
            nome: formData.nome,
            login: formData.login,
            perfil: 'Candidato'
          },
          emailRedirectTo: `${window.location.origin}/login`
        }
      });

      console.log('--- SIGNUP DEBUG ---');
      console.log('Email:', formData.email);
      console.log('Resposta completa:', authData);
      console.log('Erro:', authError);

      if (authError) {
        if (authError.message.includes('User already registered')) {
          setError('Este email já está cadastrado. Faça login.');
          setLoading(false);
          return;
        }

        console.error('Erro no cadastro:', authError.message);
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) throw new Error('Erro ao criar usuário.');

      console.log('Usuário criado no Auth:', authData.user.id);

      const { data: existingUser, error: existingUserError } = await supabase
        .from('users')
        .select('*')
        .eq('id', authData.user.id)
        .maybeSingle();

      if (existingUserError) {
        console.error('Erro ao buscar usuário:', existingUserError);
        throw new Error('Erro ao validar usuário existente.');
      }

      if (!existingUser) {
        console.log('Inserindo na tabela users...');

        const { error: userError } = await supabase.from('users').insert({
          id: authData.user.id,
          uid: authData.user.id,
          nome: formData.nome,
          email: formData.email,
          login: formData.login,
          login_lower: formData.login.toLowerCase(),
          perfil: 'Candidato',
          status: 'Ativo',
          resume_completed: false
        });

        if (userError) {
          console.error('Erro ao inserir usuário:', userError);

          try {
            await supabase.auth.admin.deleteUser(authData.user.id);
            console.log('Rollback realizado: usuário removido do Auth');
          } catch (deleteError) {
            console.error('Erro ao fazer rollback no Auth:', deleteError);
          }

          throw new Error('Erro ao salvar usuário. Tente novamente.');
        }
      }

      if (!authData.session) {
        console.log('Tentando login automático...');

        const { error: loginError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.senha
        });

        if (loginError) {
          console.warn('Login automático falhou:', loginError.message);
        }
      }

      await logAudit('Cadastro', 'Candidato', `Novo candidato cadastrado: ${formData.nome}.`);

      setSuccessMsg('Cadastro realizado com sucesso! Você já pode acessar o sistema.');

      setFormData({
        nome: '',
        login: '',
        email: '',
        senha: '',
        confirmarSenha: ''
      });

    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Erro ao realizar cadastro.');
    } finally {
      setLoading(false);
    }
  };
  // [EDITABLE_END:public_cadastro_handle_submit]

  if (successMsg) {
    return (
      <div className="py-24 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full px-4 text-center">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-4">Verifique seu e-mail</h2>
            <p className="text-slate-600 mb-8 leading-relaxed">
              {successMsg}
            </p>
            <Link to="/login" className="inline-flex items-center justify-center w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-accent transition-colors">
              Ir para o Login
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Crie sua conta</h1>
          <p className="text-slate-600 mt-2">Junte-se ao time DFL e construa o futuro conosco.</p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          {error && <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">{error}</div>}

          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
              <input required type="text" value={formData.nome} onChange={e => setFormData({...formData, nome: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Seu nome completo" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usuário de Login *</label>
              <input required type="text" value={formData.login} onChange={e => setFormData({...formData, login: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Ex: joaosilva" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail *</label>
              <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" placeholder="seu@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha *</label>
              <input required type="password" value={formData.senha} onChange={e => setFormData({...formData, senha: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Mínimo 8 caracteres" minLength={8} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Confirmar Senha *</label>
              <input required type="password" value={formData.confirmarSenha} onChange={e => setFormData({...formData, confirmarSenha: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-primary/20 outline-none" placeholder="Repita sua senha" />
            </div>

            <button disabled={loading} type="submit" className="w-full bg-primary text-white py-3 rounded-lg font-bold hover:bg-accent transition-colors disabled:opacity-50 mt-6">
              {loading ? 'Cadastrando...' : 'Cadastrar'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-slate-600">
            Já tem uma conta? <Link to="/login" className="text-primary font-medium hover:underline">Fazer Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  // [EDITABLE_START:public_login_state]
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState('');
  const [showForgot, setShowForgot] = useState(false);
  const [forgotLogin, setForgotLogin] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const navigate = useNavigate();
  const { user, profile, loading: authLoading } = useAuth();
  // [EDITABLE_END:public_login_state]

  // [EDITABLE_START:public_login_useeffect_redirect]
  useEffect(() => {
    if (!authLoading && user && profile) {
      console.log('Redirecionando usuário logado:', profile.perfil);
      const p = profile.perfil?.toLowerCase();
      if (p === 'rh') navigate('/rh', { replace: true });
      else if (p === 'admin') navigate('/admin', { replace: true });
      else navigate('/candidato', { replace: true });
    }
  }, [user, profile, authLoading, navigate]);
  // [EDITABLE_END:public_login_useeffect_redirect]

  // [EDITABLE_START:public_login_handle_submit]
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Buscar usuário pelo login
      const { data: users, error: findError } = await supabase
        .from('users')
        .select('*')
        .eq('login_lower', login.toLowerCase().trim())
        .eq('status', 'Ativo')
        .limit(1);

      if (findError) throw findError;

      if (!users || users.length === 0) {
        setError('Usuário ou senha incorretos.');
        return;
      }

      const userDoc = users[0];

      // Autenticar com email real — NUNCA transformar login em email fictício
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: userDoc.email,
        password: password,
      });

      if (authError) {
        if (authError.message?.includes('rate limit')) {
          setError('Muitas tentativas. Aguarde alguns minutos.');
        } else {
          setError('Usuário ou senha incorretos.');
        }
        return;
      }

      // Log sem bloquear o fluxo
      try {
        await supabase.from('logs').insert({
          usuario_id: userDoc.id,
          usuario_email: userDoc.email,
          acao: 'Login',
          modulo: 'Autenticação',
          detalhes: `Usuário ${userDoc.login} efetuou login`,
        });
      } catch (logErr) {
        console.warn('Erro ao registrar log:', logErr);
      }

      // Redirecionar por perfil
      const perfil = userDoc.perfil?.toLowerCase();
      if (perfil === 'admin') navigate('/admin');
      else if (perfil === 'rh') navigate('/rh');
      else navigate('/candidato');

    } catch (err: any) {
      console.error('Erro no login:', err);
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };
  // [EDITABLE_END:public_login_handle_submit]

  // [EDITABLE_START:public_login_handle_google]
  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin
        }
      });
      if (error) throw error;
    } catch (err: any) {
      console.error(err);
      setError('Erro ao entrar com Google.');
    } finally {
      setLoading(false);
    }
  };
  // [EDITABLE_END:public_login_handle_google]

  // [EDITABLE_START:public_login_handle_forgot]
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg('');
    setError('');
    setLoading(true);

    try {
      // Find user by login in Supabase
      const { data: userDocs, error: findError } = await supabase
        .from('users')
        .select('email, login')
        .eq('login', forgotLogin);

      if (findError) throw findError;

      if (!userDocs || userDocs.length === 0) {
        setError('Usuário não encontrado.');
        setLoading(false);
        return;
      }

      const userDoc = userDocs[0];
      
      // Real password reset using Supabase Auth
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(userDoc.email, {
        redirectTo: `${window.location.origin}/login?reset=true`,
      });

      if (resetError) throw resetError;

      setForgotMsg(`Um link de recuperação foi enviado para o e-mail cadastrado.`);
      
    } catch (err: any) {
      console.error(err);
      setError('Erro ao processar solicitação.');
    } finally {
      setLoading(false);
    }
  };
  // [EDITABLE_END:public_login_handle_forgot]

  if (showForgot) {
    return (
      <div className="py-12 bg-slate-50 min-h-screen flex items-center justify-center">
        <div className="max-w-md w-full px-4 sm:px-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Recuperar Senha</h1>
            <p className="text-slate-600 mt-2">Informe seu usuário de login para receber as instruções.</p>
          </div>

          <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
            {forgotMsg && <div className="mb-4 p-3 bg-emerald-100 text-emerald-700 rounded-lg text-sm">{forgotMsg}</div>}
            
            <form className="space-y-4" onSubmit={handleForgot}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Usuário de Login</label>
                <input 
                  required
                  type="text" 
                  value={forgotLogin}
                  onChange={(e) => setForgotLogin(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                />
              </div>
              <div className="pt-2">
                <button disabled={loading} type="submit" className="w-full bg-primary text-white px-4 py-2.5 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50">
                  {loading ? 'Enviando...' : 'Enviar Instruções'}
                </button>
              </div>
            </form>
            
            <p className="mt-6 text-center text-sm text-slate-600">
              Lembrou a senha? <button onClick={() => setShowForgot(false)} className="text-primary font-medium hover:underline">Voltar para o login</button>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="py-12 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4 sm:px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bem-vindo de volta</h1>
          <p className="text-slate-600 mt-2">Acesse sua conta para continuar.</p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm">{error}</div>}
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usuário de Login</label>
              <input 
                required
                type="text" 
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                placeholder="Ex: JoaoSilva!2026"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700">Senha</label>
                <button type="button" onClick={() => setShowForgot(true)} className="text-xs text-primary hover:underline">Esqueceu a senha?</button>
              </div>
              <div className="relative">
                <input 
                  required
                  type={showPassword ? "text" : "password"} 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary pr-10" 
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>
            <div className="pt-2">
              <button disabled={loading} type="submit" className="w-full bg-primary text-white px-4 py-2.5 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50">
                {loading ? 'Entrando...' : 'Entrar'}
              </button>
            </div>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-white text-slate-500">Ou continue com</span>
              </div>
            </div>

            <button
              onClick={handleGoogleLogin}
              disabled={loading}
              className="mt-4 w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>

            <div className="relative mt-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-slate-200"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-slate-500">Desenvolvimento</span>
              </div>
            </div>

            <button
              type="button"
              onClick={async () => {
                setIsSeeding(true);
                setSeedMsg('Populando banco de dados...');
                try {
                  await seedDatabase();
                  setSeedMsg('Banco de dados populado! Tente logar agora.');
                } catch (err: any) {
                  console.error('Erro no seed:', err);
                  setSeedMsg(`Erro ao popular banco: ${err.message || 'Erro desconhecido'}`);
                } finally {
                  setIsSeeding(false);
                }
              }}
              disabled={isSeeding}
              className="mt-4 w-full flex items-center justify-center gap-3 bg-slate-100 text-slate-700 py-2.5 rounded-lg font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <Database className="w-5 h-5" />
              {isSeeding ? 'Populando...' : 'Popular Banco de Dados (Seed)'}
            </button>
            {seedMsg && <p className="text-center text-[10px] mt-2 text-primary font-medium">{seedMsg}</p>}
          </div>
          
          <p className="mt-6 text-center text-sm text-slate-600">
            Não tem uma conta? <Link to="/cadastro" className="text-primary font-medium hover:underline">Cadastre-se</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function SobreNos() {
  return (
    <div className="bg-slate-50 min-h-screen pb-20">
      {/* Hero Section */}
      <section className="bg-[#0B3B60] text-white py-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/20"></div>
        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-block bg-white/10 backdrop-blur-sm border border-white/20 px-4 py-1.5 rounded-full text-sm font-medium mb-6">
            Sobre a DFL
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-6 leading-tight">
            Uma empresa de 85 anos conectada com o futuro
          </h1>
          <p className="text-lg md:text-xl text-blue-100 max-w-3xl mx-auto font-light leading-relaxed">
            Líder nacional em anestésicos injetáveis e agulhas gengivais, a única fabricante brasileira de anestésicos odontológicos em tubetes de vidro.
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-6xl mx-auto px-4 -mt-12 relative z-20 mb-20">
        <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 divide-x divide-slate-100">
            <div className="text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Globe className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">45+ países</h3>
              <p className="text-sm text-slate-500">Exportação global de produtos</p>
            </div>
            <div className="text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">85 anos</h3>
              <p className="text-sm text-slate-500">Fundada em 1939</p>
            </div>
            <div className="text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">53% mulheres</h3>
              <p className="text-sm text-slate-500">Equidade de gênero no quadro</p>
            </div>
            <div className="text-center px-4">
              <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <FlaskConical className="w-6 h-6" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900 mb-1">Lab PDI</h3>
              <p className="text-sm text-slate-500">Pesquisa e inovação de ponta</p>
            </div>
          </div>
        </div>
      </section>

      {/* Nossa História */}
      <section className="max-w-6xl mx-auto px-4 mb-24">
        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-200">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-6">Nossa História</h2>
              <div className="space-y-4 text-slate-600 leading-relaxed">
                <p>
                  A DFL foi fundada em <strong>1939</strong> como uma empresa importadora, rapidamente se estabelecendo como a maior representante da indústria americana e europeia de odontologia no Brasil.
                </p>
                <p>
                  O início da fabricação de <strong>anestésicos injetáveis em 1998</strong> marcou uma nova era para a DFL. Uma reestruturação interna modernizou a empresa, possibilitando o aumento na produtividade e a criação de um laboratório de P&D de última geração.
                </p>
                <p>
                  Hoje, a DFL exporta para mais de <strong>45 países</strong> e está expandindo sua atuação para o segmento médico, sendo referência em inovação, qualidade e responsabilidade no setor farmacêutico-odontológico.
                </p>
              </div>
            </div>
            
            <div className="relative">
              <div className="absolute left-6 top-4 bottom-4 w-px bg-slate-200"></div>
              <div className="space-y-8 relative">
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0 font-bold text-sm z-10">
                    1939
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">Fundação</h4>
                    <p className="text-slate-500 text-sm mt-1">Empresa importadora referência no setor odontológico</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0 font-bold text-sm z-10">
                    1998
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">Nova era</h4>
                    <p className="text-slate-500 text-sm mt-1">Início da fabricação de anestésicos injetáveis</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0 font-bold text-sm z-10">
                    1999
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">Internacionalização</h4>
                    <p className="text-slate-500 text-sm mt-1">Início do processo de exportação global</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 bg-slate-900 text-white rounded-xl flex items-center justify-center shrink-0 font-bold text-sm z-10">
                    2022
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">Lab PDI</h4>
                    <p className="text-slate-500 text-sm mt-1">Laboratório de pesquisa e inovação de última geração</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Laboratório de PDI */}
      <section className="max-w-6xl mx-auto px-4 mb-24 text-center">
        <h2 className="text-3xl font-bold text-slate-900 mb-3">Laboratório de PDI</h2>
        <p className="text-slate-500 mb-12">Transformando a Saúde com Modernidade e Inovação</p>
        
        <div className="grid md:grid-cols-3 gap-8 text-left">
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mb-6">
              <FlaskConical className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Quality by Design</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Abordagem orientada por dados que antecipa e controla variáveis no desenvolvimento de produtos, garantindo qualidade superior.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mb-6">
              <Award className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Medicina Baseada em Evidências</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Estudos clínicos rigorosos fundamentam cada produto, assegurando eficácia e segurança comprovadas cientificamente.
            </p>
          </div>
          <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <div className="w-12 h-12 bg-slate-100 text-slate-700 rounded-xl flex items-center justify-center mb-6">
              <Globe className="w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-3">Inovação Contínua</h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              De anestésicos injetáveis a formulações odontológicas avançadas, nosso lab é onde o futuro da saúde é criado.
            </p>
          </div>
        </div>
      </section>

      {/* Certificações */}
      <section className="max-w-6xl mx-auto px-4 mb-24">
        <div className="bg-slate-100 rounded-3xl p-8 md:p-12 text-center">
          <h2 className="text-3xl font-bold text-slate-900 mb-3">Certificações</h2>
          <p className="text-slate-500 mb-12">Reconhecimentos internacionais que atestam nossos padrões de qualidade</p>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">CBPF ANVISA</h4>
              <p className="text-xs text-slate-500">Certificado de Boas Práticas de Fabricação</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">ISO 13485:2016</h4>
              <p className="text-xs text-slate-500">Boas práticas de fabricação e segurança de produtos para saúde</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">FDA Certified</h4>
              <p className="text-xs text-slate-500">Certificação da agência federal dos EUA para produtos médicos</p>
            </div>
            <div className="bg-white p-6 rounded-2xl shadow-sm">
              <div className="w-10 h-10 bg-slate-50 text-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-900 text-sm mb-1">ISO 14001:2015</h4>
              <p className="text-xs text-slate-500">Sistema de gestão ambiental internacional</p>
            </div>
          </div>
        </div>
      </section>

      {/* Responsabilidade e Transparência */}
      <section className="max-w-6xl mx-auto px-4 mb-24">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <Leaf className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Responsabilidade Socioambiental</h3>
            </div>
            <div className="space-y-4 text-slate-600 text-sm leading-relaxed mb-8">
              <p>
                A DFL tem consciência de sua responsabilidade social e ambiental. Em 2024, a empresa realizou diversas iniciativas de impacto: apoio a colaboradores afetados pelas enchentes no RS, atendimentos oftalmológicos gratuitos para crianças vulneráveis e suporte à educação de jovens de baixa renda.
              </p>
              <p>
                Certificada com a ISO 14001:2015, a DFL está engajada em um projeto de Sustentabilidade para que suas atividades não comprometam o futuro das próximas gerações.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Ver Relatório ESG <ExternalLink className="w-4 h-4" />
            </button>
          </div>

          <div className="bg-white p-8 md:p-10 rounded-3xl shadow-sm border border-slate-200">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
              <h3 className="text-2xl font-bold text-slate-900">Transparência e Igualdade</h3>
            </div>
            <div className="space-y-4 text-slate-600 text-sm leading-relaxed mb-8">
              <p>
                Na DFL, acreditamos que o desenvolvimento sustentável passa pela promoção da equidade entre pessoas. As profissionais já representam <strong>53% do quadro de colaboradores</strong>.
              </p>
              <p>
                Publicamos anualmente nosso Relatório de Transparência e Igualdade Salarial, reforçando o compromisso com práticas justas, inclusivas e transparentes.
              </p>
            </div>
            <button className="inline-flex items-center gap-2 px-5 py-2.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors">
              Baixar Relatório <ExternalLink className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4">
        <div className="bg-[#0B3B60] rounded-3xl p-12 text-center text-white relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 to-transparent"></div>
          <div className="relative z-10">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Faça parte da DFL</h2>
            <p className="text-blue-100 mb-8 max-w-2xl mx-auto text-lg">
              Junte-se a uma empresa líder, inovadora e comprometida com o futuro da saúde odontológica no Brasil e no mundo.
            </p>
            <Link to="/" className="inline-block bg-white text-[#0B3B60] px-8 py-3 rounded-lg font-bold hover:bg-blue-50 transition-colors">
              Ver vagas abertas
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
