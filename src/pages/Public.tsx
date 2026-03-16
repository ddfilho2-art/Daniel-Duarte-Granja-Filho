import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, MapPin, Briefcase, ChevronRight, CheckCircle2, Globe, Calendar, Users, FlaskConical, Award, Leaf, Building2, Rocket, ExternalLink } from 'lucide-react';

export function Home() {
  // Em uma aplicação real, este número viria de uma API ou do estado global
  const vagasAbertas = 6;

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
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 bg-primary/5 rounded-lg text-primary">
                    <Briefcase className="w-6 h-6" />
                  </div>
                  <span className="bg-emerald-100 text-emerald-700 text-xs font-medium px-2.5 py-1 rounded-full">
                    Novo
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Analista de Qualidade Pleno</h3>
                <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Rio de Janeiro, RJ</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> Híbrido</span>
                </div>
                <Link to="/vagas/1" className="block w-full text-center bg-slate-50 text-primary font-medium py-2 rounded-lg hover:bg-primary hover:text-white transition-colors border border-slate-200 hover:border-primary">
                  Ver Detalhes
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

export function ListaVagas() {
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
              className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="w-full md:w-64 relative">
            <MapPin className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <select className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary appearance-none bg-white">
              <option value="">Todas as localidades</option>
              <option value="rj">Rio de Janeiro, RJ</option>
              <option value="sp">São Paulo, SP</option>
              <option value="remoto">Remoto</option>
            </select>
          </div>
          <button className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-accent transition-colors">
            Buscar
          </button>
        </div>

        {/* List */}
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-slate-900 mb-2">Engenheiro de Produção Sênior</h3>
                <div className="flex flex-wrap items-center gap-4 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Rio de Janeiro, RJ</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> Presencial</span>
                  <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-xs font-medium">Engenharia</span>
                </div>
              </div>
              <Link to={`/vagas/${i}`} className="shrink-0 bg-slate-50 text-primary font-medium px-6 py-2 rounded-lg hover:bg-primary hover:text-white transition-colors border border-slate-200 hover:border-primary text-center">
                Ver Detalhes
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function DetalheVaga() {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [modalType, setModalType] = useState<'success' | 'error'>('success');

  const handleApply = () => {
    const isResumeCompleted = localStorage.getItem('resumeCompleted') === 'true';
    if (isResumeCompleted) {
      setModalType('success');
      setShowModal(true);
    } else {
      setModalType('error');
      setShowModal(true);
    }
  };

  return (
    <div className="py-12 bg-slate-50 min-h-screen">
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 text-center">
            {modalType === 'success' ? (
              <>
                <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-xl font-bold text-slate-900 mb-2">Candidatura Realizada!</h3>
                <p className="text-slate-600 mb-6">Sua candidatura para Engenheiro de Produção Sênior foi enviada com sucesso.</p>
                <button 
                  onClick={() => setShowModal(false)}
                  className="w-full bg-primary text-white py-2.5 rounded-lg font-medium hover:bg-accent transition-colors"
                >
                  Fechar
                </button>
              </>
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
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Engenheiro de Produção Sênior</h1>
              <button onClick={handleApply} className="shrink-0 bg-primary text-white px-8 py-3 rounded-lg font-medium hover:bg-accent transition-colors">
                Candidatar-se
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-6 text-sm text-slate-600">
              <span className="flex items-center gap-2"><MapPin className="w-5 h-5 text-slate-400" /> Rio de Janeiro, RJ</span>
              <span className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-slate-400" /> Presencial</span>
              <span className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-slate-400" /> Tempo Integral</span>
            </div>
          </div>
          
          <div className="p-8 prose prose-slate max-w-none">
            <h3>Descrição da Vaga</h3>
            <p>Estamos em busca de um Engenheiro de Produção Sênior para atuar em nossa planta no Rio de Janeiro. O profissional será responsável por otimizar processos produtivos, garantindo a qualidade e eficiência da nossa linha de anestésicos e produtos odontológicos.</p>
            
            <h3>Responsabilidades</h3>
            <ul>
              <li>Mapear e otimizar processos de produção.</li>
              <li>Liderar projetos de melhoria contínua (Lean Manufacturing, Six Sigma).</li>
              <li>Garantir o cumprimento das normas de qualidade e segurança (ANVISA, ISO).</li>
              <li>Analisar indicadores de desempenho (KPIs) e propor planos de ação.</li>
            </ul>

            <h3>Requisitos</h3>
            <ul>
              <li>Formação superior completa em Engenharia de Produção, Química ou áreas correlatas.</li>
              <li>Experiência comprovada em indústria farmacêutica ou de dispositivos médicos.</li>
              <li>Conhecimento avançado em ferramentas de qualidade e melhoria contínua.</li>
              <li>Inglês avançado.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Cadastro() {
  return (
    <div className="py-12 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4 sm:px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Crie sua conta</h1>
          <p className="text-slate-600 mt-2">Cadastre-se para se candidatar às nossas vagas.</p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <Link to="/candidato" className="w-full flex items-center justify-center gap-3 bg-white border border-slate-300 text-slate-700 font-medium py-2.5 rounded-lg hover:bg-slate-50 transition-colors mb-6">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar com Google
          </Link>

          <div className="relative flex items-center py-2 mb-6">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 px-4 text-sm text-slate-400">ou cadastre com email</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          <form className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo</label>
              <input type="text" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
              <input type="email" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usuário de Login</label>
              <input 
                type="text" 
                pattern="^(?=.*[A-Z])(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\/-])[a-zA-Z0-9!@#$%^&*()_+{}\[\]:;<>,.?~\\/-]{8,}$"
                title="Mínimo 8 caracteres, contendo pelo menos uma letra maiúscula e um símbolo"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
              />
              <p className="text-[10px] text-slate-500 mt-1">Mínimo 8 caracteres, com letra maiúscula e símbolo.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Senha</label>
              <input type="password" className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
            </div>
            <div className="pt-2">
              <Link to="/candidato" className="block w-full text-center bg-primary text-white px-4 py-2.5 rounded-lg font-medium hover:bg-accent transition-colors">
                Criar conta
              </Link>
            </div>
          </form>
          
          <p className="mt-6 text-center text-sm text-slate-600">
            Já tem uma conta? <Link to="/login" className="text-primary font-medium hover:underline">Faça login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export function Login() {
  const [login, setLogin] = useState('rh_user');
  const [password, setPassword] = useState('RH@DFL2026');
  const navigate = useNavigate();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (login === 'rh_user') {
      navigate('/rh');
    } else if (login === 'admin_master') {
      navigate('/admin');
    } else {
      navigate('/candidato');
    }
  };

  return (
    <div className="py-12 bg-slate-50 min-h-screen flex items-center justify-center">
      <div className="max-w-md w-full px-4 sm:px-6">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Bem-vindo de volta</h1>
          <p className="text-slate-600 mt-2">Acesse sua conta para continuar.</p>
        </div>

        <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200">
          <form className="space-y-4" onSubmit={handleLogin}>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Usuário de Login</label>
              <input 
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
                <a href="#" className="text-xs text-primary hover:underline">Esqueceu a senha?</a>
              </div>
              <input 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
              />
            </div>
            <div className="pt-2">
              <button type="submit" className="block w-full text-center bg-primary text-white px-4 py-2.5 rounded-lg font-medium hover:bg-accent transition-colors">
                Entrar
              </button>
            </div>
          </form>
          
          <div className="mt-6 p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600">
            <p className="font-medium mb-2">Usuários de teste:</p>
            <ul className="space-y-1">
              <li><strong>RH:</strong> rh_user / RH@DFL2026</li>
              <li><strong>Admin:</strong> admin_master / Admin@DFL2026</li>
              <li><strong>Candidato:</strong> candidato / 123456</li>
            </ul>
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
