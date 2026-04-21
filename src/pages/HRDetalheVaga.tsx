import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Save, Eye, Repeat } from 'lucide-react';
import { TransferOwnerModal } from '../components/TransferOwnerModal';
import { useAuth } from '../contexts/AuthContext';

export function HRDetalheVaga() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [vaga, setVaga] = useState<any>(null);
  const [candidaturas, setCandidaturas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [transferModal, setTransferModal] = useState(false);
  const [departamentos, setDepartamentos] = useState<{id: string|number, nome: string}[]>([]);
  const [certificacoesPadrao, setCertificacoesPadrao] = useState<string[]>(['Outros']);
  const [rhUsers, setRhUsers] = useState<any[]>([]);
  const [provasAtivas, setProvasAtivas] = useState<any[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState('');
  const [selectedOwnerNome, setSelectedOwnerNome] = useState('');
  
  const [formData, setFormData] = useState({
    titulo: '',
    departamento: '',
    local: '',
    tipo: '',
    status: 'Aberta',
    descricao: '',
    requisitos: '',
    beneficios: '',
    salario: '',
    cep: '',
    endereco: '',
    prova_id: '',
    quantidade_vagas: 1
  });
  const [exige_prova, setExigeProva] = useState('Não');
  const [selectedCertificacoes, setSelectedCertificacoes] = useState<string[]>([]);
  const [outraCertificacao, setOutraCertificacao] = useState('');
  const [outraCertificacaoOriginal, setOutraCertificacaoOriginal] = useState('');

  const fetchData = async () => {
    if (!id) return;
    try {
      const { data: vagaData, error: vagaError } = await supabase
        .from('vagas')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      
      if (vagaError) throw vagaError;
      
      if (vagaData) {
        setVaga(vagaData);
        setFormData({
          titulo: vagaData.titulo || '',
          departamento: vagaData.departamento || '',
          local: vagaData.local || '',
          tipo: vagaData.tipo || '',
          status: vagaData.status || 'Aberta',
          descricao: vagaData.descricao || '',
          requisitos: vagaData.requisitos || '',
          beneficios: vagaData.beneficios || '',
          salario: vagaData.salario || '',
          cep: vagaData.cep || '',
          endereco: vagaData.endereco || '',
          prova_id: vagaData.prova_id || '',
          quantidade_vagas: vagaData.quantidade_vagas || 1
        });
        setExigeProva(vagaData.exige_prova || vagaData.exigeProva ? 'Sim' : 'Não');
        setSelectedCertificacoes(vagaData.certificacoes || []);
        setSelectedOwnerId(vagaData.owner_id || vagaData.ownerId || '');
        setSelectedOwnerNome(vagaData.owner?.nome || vagaData.owner_nome || vagaData.ownerNome || '');
      }

      const { data: candidaturasData, error: candidaturasError } = await supabase
        .from('candidaturas')
        .select('*')
        .eq('vaga_id', id);
      
      if (candidaturasError) throw candidaturasError;
      setCandidaturas(candidaturasData || []);
      
      const { data: deptsData, error: deptsError } = await supabase
        .from('departamentos')
        .select('*')
        .order('nome');
      
      if (!deptsError && deptsData) {
        setDepartamentos(deptsData);
      }

      const { data: certsData, error: certsError } = await supabase
        .from('certificacoes')
        .select('*')
        .order('nome');
      
      if (!certsError && certsData) {
        setCertificacoesPadrao([...certsData.map((c: any) => c.nome), 'Outros']);
      }

      const { data: rhData, error: rhError } = await supabase
        .from('users')
        .select('id, nome')
        .in('perfil', ['RH', 'Admin']);
      
      if (rhError) throw rhError;
      setRhUsers(rhData.map(d => ({ uid: d.id, nome: d.nome })));

      const { data: provasData, error: provasError } = await supabase
        .from('provas')
        .select('id, nome, versao, grupo_id')
        .order('nome')
        .order('versao', { ascending: false });
      
      if (!provasError && provasData) {
        // Group by grupo_id to show only latest version in the main dropdown
        const latestProvas: any[] = [];
        const groupsSeen = new Set();
        
        provasData.forEach(p => {
          if (p.grupo_id && !groupsSeen.has(p.grupo_id)) {
            latestProvas.push(p);
            groupsSeen.add(p.grupo_id);
          } else if (!p.grupo_id && !latestProvas.find(lp => lp.nome === p.nome)) {
            latestProvas.push(p);
          }
        });
        
        setProvasAtivas(latestProvas);
      }
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCertificacaoChange = (cert: string) => {
    if (selectedCertificacoes.includes(cert)) {
      setSelectedCertificacoes(selectedCertificacoes.filter(c => c !== cert));
    } else {
      setSelectedCertificacoes([...selectedCertificacoes, cert]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || candidaturas.length > 0) return;

    if (Number(formData.quantidade_vagas) < 1) {
      alert('A quantidade de vagas deve ser no mínimo 1.');
      return;
    }
    
    try {
      setIsSaving(true);
      
      const finalCertificacoes = selectedCertificacoes.includes('Outros') 
        ? [...selectedCertificacoes.filter(c => c !== 'Outros'), outraCertificacao]
        : selectedCertificacoes;

      const { error } = await supabase
        .from('vagas')
        .update({
          ...formData,
          quantidade_vagas: Number(formData.quantidade_vagas),
          exige_prova: exige_prova === 'Sim',
          prova_id: exige_prova === 'Sim' ? formData.prova_id : null,
          prova_versao_id: exige_prova === 'Sim' ? (formData as any).prova_versao_id : null,
          owner_id: selectedOwnerId,
          owner_nome: selectedOwnerNome,
          certificacoes: finalCertificacoes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;

      setIsSaved(true);
      setTimeout(() => setIsSaved(false), 2000);
    } catch (error) {
      console.error('Erro ao atualizar vaga:', error);
      alert('Erro ao atualizar vaga.');
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) return <div className="p-12 text-center text-slate-500">Carregando detalhes da vaga...</div>;
  if (!vaga) return <div className="p-12 text-center text-slate-500">Vaga não encontrada.</div>;

  const isReadOnly = candidaturas.length > 0;
  const isOwnerOrAdmin = profile?.perfil === 'Admin' || (vaga?.owner_id || vaga?.ownerId) === profile?.uid;
  const canEdit = !isReadOnly && isOwnerOrAdmin;

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="text-slate-500 hover:text-slate-900">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h2 className="text-2xl font-bold text-slate-900">Detalhes da Vaga: {vaga.titulo}</h2>
        {profile?.perfil === 'Admin' && (
          <button 
            onClick={() => setTransferModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-medium rounded-lg hover:bg-indigo-100 transition-colors border border-indigo-200 ml-4"
          >
            <Repeat className="w-4 h-4" />
            Transferir Proprietário
          </button>
        )}
        {isReadOnly && (
          <span className="ml-auto bg-amber-100 text-amber-800 text-xs font-medium px-2.5 py-0.5 rounded flex items-center gap-1">
            <Eye className="w-4 h-4" /> Somente Leitura (Possui Candidatos)
          </span>
        )}
        {!isOwnerOrAdmin && (
          <span className="ml-auto bg-slate-100 text-slate-800 text-xs font-medium px-2.5 py-0.5 rounded flex items-center gap-1">
            <Eye className="w-4 h-4" /> Somente Leitura (Apenas Proprietário pode editar)
          </span>
        )}
      </div>

      <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Informações Básicas */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">Informações Básicas</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Responsável pela Vaga <span className="text-red-500">*</span></label>
                <select 
                  required 
                  disabled={!canEdit}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:bg-slate-50 disabled:text-slate-500"
                  value={selectedOwnerId}
                  onChange={(e) => {
                    const user = rhUsers.find(u => u.uid === e.target.value);
                    if (user) {
                      setSelectedOwnerId(user.uid);
                      setSelectedOwnerNome(user.nome);
                    }
                  }}
                >
                  <option value="">Selecione um responsável</option>
                  {rhUsers.map(user => (
                    <option key={user.uid} value={user.uid}>{user.nome}</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Título da Vaga <span className="text-red-500">*</span></label>
                <input required disabled={!canEdit} type="text" name="titulo" value={formData.titulo} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Departamento / Área <span className="text-red-500">*</span></label>
                <select required disabled={!canEdit} name="departamento" value={formData.departamento} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:bg-slate-50 disabled:text-slate-500">
                  <option value="">Selecione</option>
                  {departamentos.map(dept => (
                    <option key={dept.id} value={dept.nome}>{dept.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Modelo de Trabalho <span className="text-red-500">*</span></label>
                <select required disabled={!canEdit} name="local" value={formData.local} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:bg-slate-50 disabled:text-slate-500">
                  <option value="">Selecione</option>
                  <option value="Presencial">Presencial</option>
                  <option value="Híbrido">Híbrido</option>
                  <option value="Remoto">Remoto</option>
                </select>
              </div>
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-slate-700 mb-1">Endereço / Local de Trabalho <span className="text-red-500">*</span></label>
                  <input required disabled={!canEdit} type="text" name="endereco" value={formData.endereco} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CEP <span className="text-red-500">*</span></label>
                  <input required disabled={!canEdit} type="text" name="cep" value={formData.cep} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Contrato <span className="text-red-500">*</span></label>
                <select required disabled={!canEdit} name="tipo" value={formData.tipo} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:bg-slate-50 disabled:text-slate-500">
                  <option value="">Selecione</option>
                  <option value="CLT">CLT</option>
                  <option value="PJ">PJ</option>
                  <option value="Estágio">Estágio</option>
                  <option value="Temporário">Temporário</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantidade de Vagas <span className="text-red-500">*</span></label>
                <input required disabled={!canEdit} type="number" min="1" name="quantidade_vagas" value={formData.quantidade_vagas} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Faixa Salarial</label>
                <input type="text" disabled={!canEdit} name="salario" value={formData.salario} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Status da Vaga <span className="text-red-500">*</span></label>
                <select required disabled={!canEdit} name="status" value={formData.status} onChange={handleInputChange} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:bg-slate-50 disabled:text-slate-500">
                  <option value="Aberta">Aberta</option>
                  <option value="Pausada">Pausada</option>
                  <option value="Encerrada">Encerrada</option>
                  <option value="Cancelada">Cancelada</option>
                </select>
              </div>
            </div>
          </div>

          {/* Detalhes da Vaga */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">Detalhes da Vaga</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Descrição da Vaga <span className="text-red-500">*</span></label>
                <textarea required disabled={!canEdit} name="descricao" value={formData.descricao} onChange={handleInputChange} rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Requisitos <span className="text-red-500">*</span></label>
                <textarea required disabled={!canEdit} name="requisitos" value={formData.requisitos} onChange={handleInputChange} rows={4} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"></textarea>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Benefícios</label>
                <textarea disabled={!canEdit} name="beneficios" value={formData.beneficios} onChange={handleInputChange} rows={3} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"></textarea>
              </div>
            </div>
          </div>

          {/* Configurações do Processo Seletivo */}
          <div>
            <h3 className="text-lg font-bold text-slate-900 mb-4 pb-2 border-b border-slate-200">Configurações do Processo Seletivo</h3>
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Exigir Prova Técnica?</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input disabled={!canEdit} type="radio" name="exige_prova" value="Sim" checked={exige_prova === 'Sim'} onChange={(e) => setExigeProva(e.target.value)} className="text-primary focus:ring-primary disabled:opacity-50" />
                    <span className="text-slate-700">Sim</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input disabled={!canEdit} type="radio" name="exige_prova" value="Não" checked={exige_prova === 'Não'} onChange={(e) => setExigeProva(e.target.value)} className="text-primary focus:ring-primary disabled:opacity-50" />
                    <span className="text-slate-700">Não</span>
                  </label>
                </div>
              </div>

              {exige_prova === 'Sim' && (
                <div className="grid grid-cols-1 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Qual Prova? <span className="text-red-500">*</span></label>
                    <select 
                      required 
                      disabled={!canEdit}
                      name="prova_id"
                      value={formData.prova_id}
                      onChange={handleInputChange}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white disabled:bg-slate-50 disabled:text-slate-500"
                    >
                      <option value="">Selecione uma prova</option>
                      {provasAtivas.map(prova => (
                        <option key={prova.id} value={prova.id}>{prova.nome} (v{prova.versao})</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Certificações Desejadas</label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {certificacoesPadrao.map((cert) => (
                    <label key={cert} className="flex items-center gap-2 cursor-pointer">
                      <input
                        disabled={!canEdit}
                        type="checkbox"
                        checked={selectedCertificacoes.includes(cert)}
                        onChange={() => handleCertificacaoChange(cert)}
                        className="rounded text-primary focus:ring-primary disabled:opacity-50"
                      />
                      <span className="text-sm text-slate-700">{cert}</span>
                    </label>
                  ))}
                </div>
                {selectedCertificacoes.includes('Outros') && (
                  <div className="mt-3">
                    <input
                      disabled={!canEdit}
                      type="text"
                      value={outraCertificacao || ''}
                      onChange={(e) => setOutraCertificacao(e.target.value)}
                      placeholder="Especifique a certificação"
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-slate-50 disabled:text-slate-500"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="pt-6 border-t border-slate-200 flex justify-end gap-4">
              <button
                type="button"
                onClick={() => navigate(-1)}
                className="px-6 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
                disabled={isSaving}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-70"
                disabled={isSaving}
              >
                {isSaving ? (
                  <>Salvando...</>
                ) : isSaved ? (
                  <>Salvo com sucesso!</>
                ) : (
                  <><Save className="w-5 h-5" /> Salvar Alterações</>
                )}
              </button>
            </div>
          )}
        </form>
      </div>

      {transferModal && (
        <TransferOwnerModal
          isOpen={transferModal}
          onClose={() => setTransferModal(false)}
          vaga={vaga}
          onSuccess={() => {
            fetchData(); // Refresh data to show new owner
          }}
        />
      )}
    </div>
  );
}
