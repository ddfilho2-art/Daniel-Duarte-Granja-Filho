import { Link } from 'react-router-dom';
import { Briefcase, CheckCircle2, Clock, FileText, Search, User, MapPin, Plus, Trash2, Camera } from 'lucide-react';
import React, { useState, useEffect } from 'react';

export function CandidateDashboard() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-primary/10 rounded-lg text-primary">
              <Briefcase className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Candidaturas Ativas</p>
              <h3 className="text-2xl font-bold text-slate-900">3</h3>
            </div>
          </div>
          <Link to="/candidato/candidaturas" className="text-sm text-primary font-medium hover:underline">Ver todas</Link>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-100 rounded-lg text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Provas Concluídas</p>
              <h3 className="text-2xl font-bold text-slate-900">1</h3>
            </div>
          </div>
          <Link to="/candidato/provas" className="text-sm text-primary font-medium hover:underline">Ver provas</Link>
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-100 rounded-lg text-amber-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">Entrevistas Agendadas</p>
              <h3 className="text-2xl font-bold text-slate-900">1</h3>
            </div>
          </div>
          <Link to="/candidato/mensagens" className="text-sm text-primary font-medium hover:underline">Ver mensagens</Link>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-6 border-b border-slate-200 flex justify-between items-center">
          <h2 className="text-lg font-bold text-slate-900">Candidaturas recentes</h2>
        </div>
        <div className="divide-y divide-slate-200">
          {[1, 2, 3].map((i) => (
            <div key={i} className="p-6 flex items-center justify-between">
              <div>
                <h4 className="font-medium text-slate-900">Engenheiro de Produção Sênior</h4>
                <p className="text-sm text-slate-500">Candidatura enviada em 10/10/2026</p>
              </div>
              <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-xs font-medium">
                Em análise
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

type Experience = { id: string, empresa: string, cargo: string, dataInicio: string, dataFim: string, atual: boolean, descricao: string };
type Education = { id: string, instituicao: string, curso: string, grau: string, anoInicio: string, anoFim: string };
type Language = { id: string, idioma: string, nivel: string };
type Certification = { id: string, nome: string, instituicao: string, ano: string };

export function CandidateResume() {
  const [formData, setFormData] = useState({
    nome: 'João Silva',
    email: 'joao.silva@email.com',
    telefone: '(21) 99999-9999',
    linkedin: 'https://linkedin.com/in/joaosilva',
    dataNascimento: '1990-05-15',
    genero: 'Masculino',
    pcd: 'Não',
    cep: '20000-000',
    logradouro: 'Rua das Flores',
    numero: '123',
    complemento: 'Apto 402',
    bairro: 'Centro',
    cidade: 'Rio de Janeiro',
    estado: 'RJ',
    resumo: 'Engenheiro de produção com 5 anos de experiência na indústria farmacêutica...',
    experiencias: [
      { id: '1', empresa: 'Empresa X', cargo: 'Engenheiro de Produção Sênior', dataInicio: '2020-01', dataFim: '', atual: true, descricao: 'Otimização de processos produtivos e liderança de projetos Six Sigma.' }
    ] as Experience[],
    formacoes: [
      { id: '1', instituicao: 'UFRJ', curso: 'Engenharia de Produção', grau: 'Graduação', anoInicio: '2015', anoFim: '2019' }
    ] as Education[],
    idiomas: [
      { id: '1', idioma: 'Inglês', nivel: 'Avançado' }
    ] as Language[],
    certificacoes: [
      { id: '1', nome: 'Green Belt Six Sigma', instituicao: 'Seta', ano: '2021' }
    ] as Certification[],
    habilidades: 'Lean Manufacturing, Six Sigma, Gestão de Projetos',
    foto: ''
  });

  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    const savedData = localStorage.getItem('candidateResumeStructured');
    if (savedData) {
      setFormData(JSON.parse(savedData));
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setIsSaved(false);
  };

  const handleExperienceChange = (id: string, field: keyof Experience, value: string | boolean) => {
    setFormData({
      ...formData,
      experiencias: formData.experiencias.map(exp => exp.id === id ? { ...exp, [field]: value } : exp)
    });
    setIsSaved(false);
  };

  const handleEducationChange = (id: string, field: keyof Education, value: string) => {
    setFormData({
      ...formData,
      formacoes: formData.formacoes.map(edu => edu.id === id ? { ...edu, [field]: value } : edu)
    });
    setIsSaved(false);
  };

  const handleLanguageChange = (id: string, field: keyof Language, value: string) => {
    setFormData({
      ...formData,
      idiomas: formData.idiomas.map(lang => lang.id === id ? { ...lang, [field]: value } : lang)
    });
    setIsSaved(false);
  };

  const handleCertificationChange = (id: string, field: keyof Certification, value: string) => {
    setFormData({
      ...formData,
      certificacoes: formData.certificacoes.map(cert => cert.id === id ? { ...cert, [field]: value } : cert)
    });
    setIsSaved(false);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, foto: reader.result as string });
        setIsSaved(false);
      };
      reader.readAsDataURL(file);
    }
  };

  const addExperience = () => {
    setFormData({
      ...formData,
      experiencias: [...formData.experiencias, { id: Date.now().toString(), empresa: '', cargo: '', dataInicio: '', dataFim: '', atual: false, descricao: '' }]
    });
  };

  const removeExperience = (id: string) => {
    setFormData({
      ...formData,
      experiencias: formData.experiencias.filter(exp => exp.id !== id)
    });
  };

  const addEducation = () => {
    setFormData({
      ...formData,
      formacoes: [...formData.formacoes, { id: Date.now().toString(), instituicao: '', curso: '', grau: 'Graduação', anoInicio: '', anoFim: '' }]
    });
  };

  const removeEducation = (id: string) => {
    setFormData({
      ...formData,
      formacoes: formData.formacoes.filter(edu => edu.id !== id)
    });
  };

  const addLanguage = () => {
    setFormData({
      ...formData,
      idiomas: [...formData.idiomas, { id: Date.now().toString(), idioma: '', nivel: 'Conhecimento Básico' }]
    });
  };

  const removeLanguage = (id: string) => {
    setFormData({
      ...formData,
      idiomas: formData.idiomas.filter(lang => lang.id !== id)
    });
  };

  const addCertification = () => {
    setFormData({
      ...formData,
      certificacoes: [...formData.certificacoes, { id: Date.now().toString(), nome: '', instituicao: '', ano: '' }]
    });
  };

  const removeCertification = (id: string) => {
    setFormData({
      ...formData,
      certificacoes: formData.certificacoes.filter(cert => cert.id !== id)
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('candidateResumeStructured', JSON.stringify(formData));
    localStorage.setItem('resumeCompleted', 'true');
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const calculateCompletion = () => {
    const requiredFields = ['nome', 'email', 'telefone', 'dataNascimento', 'logradouro', 'numero', 'bairro', 'cidade', 'estado', 'resumo'];
    const filledFields = requiredFields.filter(field => formData[field as keyof typeof formData]?.toString().trim() !== '');
    
    let score = filledFields.length;
    let total = requiredFields.length + 2; // +2 for at least 1 exp and 1 edu

    if (formData.experiencias.length > 0 && formData.experiencias[0].empresa.trim() !== '') score++;
    if (formData.formacoes.length > 0 && formData.formacoes[0].instituicao.trim() !== '') score++;

    return Math.round((score / total) * 100);
  };

  const completion = calculateCompletion();

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <div className="flex items-center gap-6 mb-8">
          <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center text-primary text-3xl font-bold relative group overflow-hidden">
            {formData.foto ? (
              <img src={formData.foto} alt="Foto de perfil" className="w-full h-full object-cover" />
            ) : (
              formData.nome ? formData.nome.charAt(0).toUpperCase() : 'U'
            )}
            <label className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" title="Alterar foto">
              <Camera className="w-6 h-6 text-white" />
              <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
            </label>
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-slate-900">{formData.nome || 'Seu Nome'}</h2>
            <p className="text-slate-500">Meu Currículo</p>
            <div className="flex gap-4 mt-2 items-center">
              <span className="text-sm text-slate-500 flex items-center gap-1"><MapPin className="w-4 h-4" /> {formData.cidade || 'Cidade'}, {formData.estado || 'UF'}</span>
              <div className="flex items-center gap-2 flex-1 max-w-xs ml-4">
                <span className="text-sm font-medium text-slate-700">{completion}% preenchido</span>
                <div className="h-2 flex-1 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className={`h-full ${completion === 100 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                    style={{ width: `${completion}%` }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Dados Pessoais */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">Dados Pessoais</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Nome completo <span className="text-red-500">*</span></label>
                <input required type="text" name="nome" value={formData.nome} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento <span className="text-red-500">*</span></label>
                <input required type="date" name="dataNascimento" value={formData.dataNascimento} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email <span className="text-red-500">*</span></label>
                <input required type="email" name="email" value={formData.email} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone <span className="text-red-500">*</span></label>
                <input required type="tel" name="telefone" value={formData.telefone} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gênero</label>
                <select name="genero" value={formData.genero} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                  <option value="">Selecione</option>
                  <option value="Feminino">Feminino</option>
                  <option value="Masculino">Masculino</option>
                  <option value="Não-binário">Não-binário</option>
                  <option value="Prefiro não informar">Prefiro não informar</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Pessoa com Deficiência (PcD)?</label>
                <select name="pcd" value={formData.pcd} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                  <option value="Não">Não</option>
                  <option value="Sim">Sim</option>
                </select>
              </div>
            </div>
          </div>

          {/* Endereço */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">Endereço</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="md:col-span-4">
                <label className="block text-sm font-medium text-slate-700 mb-1">Logradouro (Rua, Av.) <span className="text-red-500">*</span></label>
                <input required type="text" name="logradouro" value={formData.logradouro} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Número <span className="text-red-500">*</span></label>
                <input required type="text" name="numero" value={formData.numero} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Complemento</label>
                <input type="text" name="complemento" value={formData.complemento} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Bairro <span className="text-red-500">*</span></label>
                <input required type="text" name="bairro" value={formData.bairro} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Cidade <span className="text-red-500">*</span></label>
                <input required type="text" name="cidade" value={formData.cidade} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-slate-700 mb-1">Estado (UF) <span className="text-red-500">*</span></label>
                <input required type="text" name="estado" value={formData.estado} onChange={handleChange} maxLength={2} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary uppercase" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">CEP</label>
                <input type="text" name="cep" value={formData.cep} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
            </div>
          </div>

          {/* Resumo e Links */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">Perfil Profissional</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">LinkedIn</label>
                <input type="url" name="linkedin" value={formData.linkedin} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Resumo Profissional <span className="text-red-500">*</span></label>
                <textarea required name="resumo" value={formData.resumo} onChange={handleChange} rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Fale um pouco sobre você e seus objetivos..."></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Habilidades (separadas por vírgula)</label>
                <input type="text" name="habilidades" value={formData.habilidades} onChange={handleChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" placeholder="Ex: Pacote Office, Python, Gestão de Projetos" />
              </div>
            </div>
          </div>

          {/* Experiência Profissional */}
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Experiência Profissional <span className="text-red-500">*</span></h3>
              <button type="button" onClick={addExperience} className="text-sm flex items-center gap-1 text-primary font-medium hover:underline">
                <Plus className="w-4 h-4" /> Adicionar Experiência
              </button>
            </div>
            
            <div className="space-y-6">
              {formData.experiencias.map((exp, index) => (
                <div key={exp.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative">
                  {formData.experiencias.length > 1 && (
                    <button type="button" onClick={() => removeExperience(exp.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Empresa</label>
                      <input required type="text" value={exp.empresa} onChange={(e) => handleExperienceChange(exp.id, 'empresa', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Cargo</label>
                      <input required type="text" value={exp.cargo} onChange={(e) => handleExperienceChange(exp.id, 'cargo', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Data de Início</label>
                      <input required type="month" value={exp.dataInicio} onChange={(e) => handleExperienceChange(exp.id, 'dataInicio', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
                    </div>
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-sm font-medium text-slate-700">Data de Fim</label>
                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <input type="checkbox" checked={exp.atual} onChange={(e) => handleExperienceChange(exp.id, 'atual', e.target.checked)} className="rounded text-primary focus:ring-primary" />
                          Trabalho atual
                        </label>
                      </div>
                      <input type="month" value={exp.dataFim} disabled={exp.atual} onChange={(e) => handleExperienceChange(exp.id, 'dataFim', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:bg-slate-100 disabled:text-slate-400" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Descrição das Atividades</label>
                    <textarea required value={exp.descricao} onChange={(e) => handleExperienceChange(exp.id, 'descricao', e.target.value)} rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"></textarea>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Formação Acadêmica */}
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Formação Acadêmica <span className="text-red-500">*</span></h3>
              <button type="button" onClick={addEducation} className="text-sm flex items-center gap-1 text-primary font-medium hover:underline">
                <Plus className="w-4 h-4" /> Adicionar Formação
              </button>
            </div>
            
            <div className="space-y-6">
              {formData.formacoes.map((edu, index) => (
                <div key={edu.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 relative">
                  {formData.formacoes.length > 1 && (
                    <button type="button" onClick={() => removeEducation(edu.id)} className="absolute top-4 right-4 text-slate-400 hover:text-red-500">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Instituição de Ensino</label>
                      <input required type="text" value={edu.instituicao} onChange={(e) => handleEducationChange(edu.id, 'instituicao', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Grau de Educação</label>
                      <select required value={edu.grau} onChange={(e) => handleEducationChange(edu.id, 'grau', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                        <option value="Ensino Médio">Ensino Médio</option>
                        <option value="Ensino Técnico">Ensino Técnico</option>
                        <option value="Graduação">Graduação</option>
                        <option value="Pós-graduação">Pós-graduação</option>
                        <option value="Mestrado">Mestrado</option>
                        <option value="Doutorado">Doutorado</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1">Nome do Curso</label>
                      <input required type="text" value={edu.curso} onChange={(e) => handleEducationChange(edu.id, 'curso', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ano Início</label>
                        <input required type="number" min="1950" max="2030" value={edu.anoInicio} onChange={(e) => handleEducationChange(edu.id, 'anoInicio', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" placeholder="Ex: 2015" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ano Fim</label>
                        <input type="number" min="1950" max="2030" value={edu.anoFim} onChange={(e) => handleEducationChange(edu.id, 'anoFim', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" placeholder="Ex: 2019" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Idiomas */}
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Idiomas</h3>
              <button type="button" onClick={addLanguage} className="text-sm flex items-center gap-1 text-primary font-medium hover:underline">
                <Plus className="w-4 h-4" /> Adicionar Idioma
              </button>
            </div>
            
            <div className="space-y-4">
              {formData.idiomas.map((lang) => (
                <div key={lang.id} className="flex items-end gap-4 p-4 border border-slate-200 rounded-lg bg-slate-50 relative">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Idioma</label>
                    <input required type="text" value={lang.idioma} onChange={(e) => handleLanguageChange(lang.id, 'idioma', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" placeholder="Ex: Inglês, Espanhol" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nível</label>
                    <select required value={lang.nivel} onChange={(e) => handleLanguageChange(lang.id, 'nivel', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                      <option value="Conhecimento Básico">Conhecimento Básico</option>
                      <option value="Intermediário">Intermediário</option>
                      <option value="Avançado">Avançado</option>
                      <option value="Fluente">Fluente / Nativo</option>
                    </select>
                  </div>
                  <button type="button" onClick={() => removeLanguage(lang.id)} className="text-slate-400 hover:text-red-500 pb-2">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {formData.idiomas.length === 0 && (
                <p className="text-sm text-slate-500 italic">Nenhum idioma adicionado.</p>
              )}
            </div>
          </div>

          {/* Certificações */}
          <div>
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-200">
              <h3 className="text-lg font-bold text-slate-900">Certificações e Cursos</h3>
              <button type="button" onClick={addCertification} className="text-sm flex items-center gap-1 text-primary font-medium hover:underline">
                <Plus className="w-4 h-4" /> Adicionar Certificação
              </button>
            </div>
            
            <div className="space-y-4">
              {formData.certificacoes.map((cert) => (
                <div key={cert.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 border border-slate-200 rounded-lg bg-slate-50 relative">
                  <div className="md:col-span-5">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Nome da Certificação/Curso</label>
                    <input required type="text" value={cert.nome} onChange={(e) => handleCertificationChange(cert.id, 'nome', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
                  </div>
                  <div className="md:col-span-4">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Instituição Emissora</label>
                    <input required type="text" value={cert.instituicao} onChange={(e) => handleCertificationChange(cert.id, 'instituicao', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Ano</label>
                    <input required type="number" min="1950" max="2030" value={cert.ano} onChange={(e) => handleCertificationChange(cert.id, 'ano', e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white" placeholder="Ex: 2023" />
                  </div>
                  <div className="md:col-span-1 flex items-end justify-end pb-2">
                    <button type="button" onClick={() => removeCertification(cert.id)} className="text-slate-400 hover:text-red-500">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ))}
              {formData.certificacoes.length === 0 && (
                <p className="text-sm text-slate-500 italic">Nenhuma certificação adicionada.</p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <p className="text-sm text-slate-500"><span className="text-red-500">*</span> Campos obrigatórios para candidatura</p>
            <div className="flex items-center gap-4">
              {isSaved && <span className="text-emerald-600 font-medium text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Currículo salvo!</span>}
              <button type="submit" className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-accent transition-colors">
                Salvar Currículo
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

export function CandidateVagas() {
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredVagas, setFilteredVagas] = useState([1, 2, 3, 4, 5, 6]);

  const handleSearch = () => {
    // Basic mock search logic
    if (searchTerm.trim() === '') {
      setFilteredVagas([1, 2, 3, 4, 5, 6]);
    } else {
      // Just mock filtering down to 2 items if there's a search term
      setFilteredVagas([1, 2]);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text" 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Buscar por cargo ou palavra-chave..." 
            className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <button onClick={handleSearch} className="bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-accent transition-colors">
          Buscar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredVagas.map((i) => (
          <div key={i} className="bg-white p-6 rounded-xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Analista de Laboratório</h3>
            <div className="flex items-center gap-4 text-sm text-slate-500 mb-6">
              <span className="flex items-center gap-1"><MapPin className="w-4 h-4" /> Rio de Janeiro, RJ</span>
              <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> Presencial</span>
            </div>
            <Link to={`/candidato/vagas/${i}`} className="block w-full text-center bg-slate-50 text-primary font-medium py-2 rounded-lg hover:bg-primary hover:text-white transition-colors border border-slate-200 hover:border-primary">
              Ver Detalhes
            </Link>
          </div>
        ))}
        {filteredVagas.length === 0 && (
          <div className="col-span-full text-center py-12 text-slate-500">
            Nenhuma vaga encontrada para "{searchTerm}".
          </div>
        )}
      </div>
    </div>
  );
}

export function CandidatePlaceholder({ title }: { title: string }) {
  return (
    <div className="bg-white p-8 rounded-xl shadow-sm border border-slate-200 text-center">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">{title}</h2>
      <p className="text-slate-500">Esta página está em construção.</p>
    </div>
  );
}

export function CandidateCandidaturas() {
  const candidaturas = [
    { id: 1, vaga: 'Engenheiro de Produção Sênior', data: '10/10/2026', status: 'Em análise', fase: 'Triagem de Currículos', ativa: true },
    { id: 2, vaga: 'Gerente de Projetos', data: '05/10/2026', status: 'Avançou', fase: 'Entrevista com RH', ativa: true },
    { id: 3, vaga: 'Analista de Qualidade', data: '01/10/2026', status: 'Reprovado', fase: 'Teste Técnico', ativa: false },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Minhas Candidaturas</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-200">
          {candidaturas.map((c) => (
            <div key={c.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900 text-lg">{c.vaga}</h4>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Candidatura: {c.data}</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-4 h-4" /> Vaga {c.ativa ? 'Ativa' : 'Encerrada'}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  c.status === 'Em análise' ? 'bg-amber-100 text-amber-700' :
                  c.status === 'Avançou' ? 'bg-emerald-100 text-emerald-700' :
                  'bg-red-100 text-red-700'
                }`}>
                  {c.status}
                </span>
                <span className="text-sm font-medium text-slate-700">Fase atual: {c.fase}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CandidateMensagens() {
  const [selectedVagaId, setSelectedVagaId] = useState<number>(1);
  const [newMessage, setNewMessage] = useState('');

  const [conversas, setConversas] = useState([
    {
      vagaId: 1,
      vagaTitulo: 'Gerente de Projetos',
      empresa: 'DFL',
      ultimaMensagem: 'Olá João, gostaríamos de agendar...',
      dataUltimaMensagem: 'Hoje, 10:30',
      mensagens: [
        { id: 1, remetente: 'RH', texto: 'Olá João, gostaríamos de agendar uma entrevista online para a vaga de Gerente de Projetos. Você teria disponibilidade na próxima terça-feira às 14h?', horario: '10:30' },
        { id: 2, remetente: 'Candidato', texto: 'Olá! Sim, tenho disponibilidade na terça-feira às 14h. Aguardo o link para a reunião.', horario: '10:45' }
      ]
    },
    {
      vagaId: 2,
      vagaTitulo: 'Engenheiro de Produção Sênior',
      empresa: 'DFL',
      ultimaMensagem: 'Recebemos seu currículo com sucesso.',
      dataUltimaMensagem: '10/10/2026',
      mensagens: [
        { id: 1, remetente: 'RH', texto: 'Recebemos seu currículo com sucesso. Em breve daremos um retorno sobre as próximas etapas.', horario: '09:00' }
      ]
    }
  ]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    setConversas(prev => prev.map(conversa => {
      if (conversa.vagaId === selectedVagaId) {
        return {
          ...conversa,
          ultimaMensagem: newMessage,
          dataUltimaMensagem: `Hoje, ${timeString}`,
          mensagens: [
            ...conversa.mensagens,
            { id: Date.now(), remetente: 'Candidato', texto: newMessage, horario: timeString }
          ]
        };
      }
      return conversa;
    }));

    console.log(`[SIMULAÇÃO DE E-MAIL] Para: rh@dfl.com.br | Assunto: Nova mensagem de candidato - Vaga: ${conversas.find(c => c.vagaId === selectedVagaId)?.vagaTitulo} | Mensagem: "${newMessage}"`);
    alert('Mensagem enviada com sucesso para a equipe de Recursos Humanos!');

    setNewMessage('');
  };

  const conversaAtiva = conversas.find(c => c.vagaId === selectedVagaId);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Mensagens</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden flex h-[600px]">
        {/* Lista de conversas */}
        <div className="w-1/3 border-r border-slate-200 flex flex-col">
          <div className="p-4 border-b border-slate-200 bg-slate-50">
            <h3 className="font-bold text-slate-900">Minhas Candidaturas</h3>
          </div>
          <div className="divide-y divide-slate-200 overflow-y-auto flex-1">
            {conversas.map(conversa => (
              <div 
                key={conversa.vagaId}
                onClick={() => setSelectedVagaId(conversa.vagaId)}
                className={`p-4 cursor-pointer border-l-4 transition-colors ${selectedVagaId === conversa.vagaId ? 'bg-primary/5 border-primary' : 'hover:bg-slate-50 border-transparent'}`}
              >
                <h4 className="font-bold text-slate-900 text-sm">{conversa.vagaTitulo}</h4>
                <p className="text-xs text-slate-500 mt-1 truncate">{conversa.ultimaMensagem}</p>
                <span className="text-[10px] text-slate-400 mt-2 block">{conversa.dataUltimaMensagem}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Chat ativo */}
        {conversaAtiva ? (
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b border-slate-200 bg-white">
              <h3 className="font-bold text-slate-900">{conversaAtiva.vagaTitulo}</h3>
              <p className="text-xs text-slate-500">Recursos Humanos - {conversaAtiva.empresa}</p>
            </div>
            <div className="flex-1 p-4 overflow-y-auto bg-slate-50 space-y-4">
              {conversaAtiva.mensagens.map(msg => (
                <div key={msg.id} className={`flex ${msg.remetente === 'Candidato' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`${msg.remetente === 'Candidato' ? 'bg-primary text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 rounded-tl-none'} rounded-lg p-3 max-w-[80%]`}>
                    <p className="text-sm">{msg.texto}</p>
                    <span className={`text-[10px] mt-1 block ${msg.remetente === 'Candidato' ? 'text-primary-foreground/70 text-right' : 'text-slate-400'}`}>{msg.horario}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-slate-200 bg-white">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <input 
                  type="text" 
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem para o RH..." 
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" 
                />
                <button type="submit" disabled={!newMessage.trim()} className="bg-primary text-white px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  Enviar
                </button>
              </form>
              <p className="text-xs text-slate-400 mt-2 text-center">As mensagens também são enviadas para o seu email cadastrado e para o RH.</p>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center bg-slate-50">
            <p className="text-slate-500">Selecione uma vaga para ver as mensagens.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export function CandidateProvas() {
  const provas = [
    { id: 1, vaga: 'Analista de Qualidade', prova: 'Teste de Excel Avançado', tipo: 'Online', status: 'Concluída', resultado: 'Aprovado (85%)', data: '02/10/2026' },
    { id: 2, vaga: 'Engenheiro de Produção Sênior', prova: 'Teste de Lógica e Processos', tipo: 'PDF (Upload)', status: 'Pendente', resultado: '-', data: '-' },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-slate-900">Minhas Provas</h2>
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="divide-y divide-slate-200">
          {provas.map((p) => (
            <div key={p.id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h4 className="font-bold text-slate-900 text-lg">{p.prova}</h4>
                <p className="text-sm text-slate-600 font-medium">{p.vaga}</p>
                <div className="flex items-center gap-4 mt-2 text-sm text-slate-500">
                  <span className="flex items-center gap-1"><FileText className="w-4 h-4" /> Tipo: {p.tipo}</span>
                  <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> Realizada em: {p.data}</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-3">
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  p.status === 'Concluída' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  {p.status}
                </span>
                {p.status === 'Concluída' ? (
                  <span className="text-sm font-bold text-slate-700">Resultado: {p.resultado}</span>
                ) : (
                  <button className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-accent transition-colors">
                    {p.tipo === 'Online' ? 'Acessar Prova' : 'Enviar Arquivo'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
