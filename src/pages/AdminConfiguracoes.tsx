import React, { useState, useEffect } from 'react';
import { Save, Mail, FileText, Settings, Plus, Trash2, Edit2, GripVertical, Check, X, Briefcase, ChevronUp, ChevronDown, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { safeFetch } from '../lib/api';

const regrasSchema = [
  {
    id: 'regrasTempoCancelamentoVaga',
    label: 'Tempo máximo permitido para cancelar após criação',
    description: 'Tempo máximo permitido para cancelar uma vaga após a criação.',
    type: 'number',
    unit: 'horas',
    defaultValue: 4
  },
  {
    id: 'regrasTempoEdicaoVaga',
    label: 'Tempo limite para edição de vaga',
    description: 'Tempo máximo permitido para editar uma vaga após a criação.',
    type: 'number',
    unit: 'horas',
    defaultValue: 24
  }
];

interface ListItemProps {
  item: { id: number | string; nome: string };
  index: number;
  listName: string;
  onUpdate: (listName: string, id: number | string, newName: string) => void;
  onDelete: (listName: string, id: number | string) => void;
  onMove?: (listName: string, dragIndex: number, hoverIndex: number) => void;
  showOrder?: boolean;
  totalItems: number;
}

const ListItem: React.FC<ListItemProps> = ({ item, index, listName, onUpdate, onDelete, onMove, showOrder, totalItems }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(item.nome);

  const handleSave = () => {
    if (editValue.trim()) {
      onUpdate(listName, item.id, editValue.trim());
      setIsEditing(false);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg p-2 shadow-sm group hover:border-slate-300 transition-colors">
      {showOrder && onMove && (
        <div className="flex flex-col -space-y-1">
          <button 
            type="button" 
            onClick={() => onMove(listName, index, index - 1)} 
            disabled={index === 0} 
            className="text-slate-300 hover:text-primary disabled:opacity-30 p-0.5"
          >
            <ChevronUp className="w-4 h-4" />
          </button>
          <button 
            type="button" 
            onClick={() => onMove(listName, index, index + 1)} 
            disabled={index === totalItems - 1}
            className="text-slate-300 hover:text-primary disabled:opacity-30 p-0.5"
          >
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>
      )}

      {isEditing ? (
        <div className="flex-1 flex items-center gap-2">
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="flex-1 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:border-primary"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSave();
              } else if (e.key === 'Escape') {
                setIsEditing(false);
                setEditValue(item.nome);
              }
            }}
          />
          <button type="button" onClick={handleSave} className="text-emerald-600 hover:text-emerald-700 p-1">
            <Check className="w-4 h-4" />
          </button>
          <button type="button" onClick={() => { setIsEditing(false); setEditValue(item.nome); }} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <>
          <span className="flex-1 text-sm text-slate-700">{item.nome}</span>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => setIsEditing(true)} className="text-slate-400 hover:text-primary p-1">
              <Edit2 className="w-3.5 h-3.5" />
            </button>
            <button type="button" onClick={() => onDelete(listName, item.id)} className="text-slate-400 hover:text-rose-500 p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </>
      )}
    </div>
  );
};

// Sanitize function to strictly enforce payload
function sanitizeDepartamentos(input: any[]) {
  return input
    .filter(d => d && typeof d.nome === 'string' && d.nome.trim() !== '')
    .map(d => ({
      id: typeof d.id === 'string' && !d.id.startsWith('temp-') ? d.id : undefined,
      nome: d.nome.trim(),
      _temp_id: typeof d.id === 'string' && d.id.startsWith('temp-') ? d.id : undefined
    }));
}

export function AdminConfiguracoes() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [config, setConfig] = useState<Record<string, any>>({
    emailTemplateSubject: 'Nova Mensagem do RH - [Nome da Empresa]',
    emailTemplateBody: 'Olá [Nome do Candidato],\n\nVocê tem uma nova mensagem do RH referente à sua candidatura para a vaga de [Título da Vaga].\n\nAcesse o portal do candidato para visualizar e responder.\n\nAtenciosamente,\nEquipe de RH',
    regrasTempoCancelamentoVaga: 4,
    regrasTempoEdicaoVaga: 24,
    inviteTemplateSubject: 'Convite para Candidatura - [Nome da Empresa]',
    inviteTemplateBody: 'Olá [Nome do Candidato],\n\nGostaríamos de convidá-lo para se candidatar à vaga de [Título da Vaga] na [Nome da Empresa].\n\nAcesse nossa plataforma para mais detalhes e para confirmar sua candidatura.\n\nAtenciosamente,\nEquipe de RH',
    departamentos: [],
    certificacoes: []
  });

  const fetchConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'email')
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error; // PGRST116 is "no rows returned"
      
      let settingsData = {};
      if (data) {
        // If the table has a 'data' column (JSONB), use it. Otherwise use the row itself.
        settingsData = data.data || data;
      }

      const { data: deptsData } = await supabase.from('departamentos').select('*').order('nome');
      const { data: certsData } = await supabase.from('certificacoes').select('*').order('nome');

      setConfig(prev => ({ 
        ...prev, 
        ...settingsData,
        departamentos: deptsData || [],
        certificacoes: certsData || []
      }));
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfig();
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setConfig(prev => ({ 
      ...prev, 
      [name]: type === 'number' ? Number(value) : value 
    }));
  };

  const handleAddListItem = (listName: string) => {
    setConfig(prev => {
      const currentList = prev[listName] || [];
      // Usar um ID temporário que será removido antes de enviar ao banco
      const newId = `temp-${Date.now()}-${Math.random()}`;
      return {
        ...prev,
        [listName]: [...currentList, { id: newId, nome: 'Novo Item' }]
      };
    });
  };

  const handleUpdateListItem = (listName: string, id: number | string, newName: string) => {
    setConfig(prev => ({
      ...prev,
      [listName]: prev[listName].map((item: any) => item.id === id ? { ...item, nome: newName } : item)
    }));
  };

  const handleDeleteListItem = (listName: string, id: number | string) => {
    // Removed window.confirm due to iframe constraints
    setConfig(prev => ({
      ...prev,
      [listName]: prev[listName].filter((item: any) => item.id !== id)
    }));
  };

  const handleMoveListItem = (listName: string, fromIndex: number, toIndex: number) => {
    setConfig(prev => {
      const currentList = [...(prev[listName] || [])];
      const [movedItem] = currentList.splice(fromIndex, 1);
      currentList.splice(toIndex, 0, movedItem);
      return {
        ...prev,
        [listName]: currentList
      };
    });
  };

  const [saveMessage, setSaveMessage] = useState({ show: false, text: '', type: 'success' });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { departamentos, certificacoes, ...settingsData } = config;

      const settingsPayload = {
        id: 'email',
        data: settingsData,
        updated_at: new Date().toISOString()
      };
      
      console.log('--- SAVING SETTINGS ---');
      console.log('PAYLOAD:', settingsPayload);
      const { data: savedSettings, error: settingsError } = await supabase
        .from('settings')
        .upsert(settingsPayload)
        .select();
      console.log('RESPONSE:', savedSettings);
      console.log('ERROR:', settingsError);
      
      if (settingsError) throw settingsError;

      console.log('--- SAVING DEPARTAMENTOS ---');
      if (departamentos) {
        if (departamentos.length > 0) {
          const sanitizedDepts = sanitizeDepartamentos(departamentos);

          const updatePayload = sanitizedDepts
            .filter(d => d.id)
            .map(({ _temp_id, ...d }) => d);

          const insertPayload = sanitizedDepts
            .filter(d => !d.id)
            .map(({ id, _temp_id, ...d }) => d);

          let savedDepts: any[] = [];

          if (updatePayload.length > 0) {
            console.log('UPDATE PAYLOAD DEPT:', updatePayload);
            const { data, error } = await supabase
              .from('departamentos')
              .upsert(updatePayload, { onConflict: 'id' })
              .select();
            if (error) throw error;
            if (data) savedDepts = [...savedDepts, ...data];
          }

          if (insertPayload.length > 0) {
            console.log('INSERT PAYLOAD DEPT:', insertPayload);
            const { data, error } = await supabase
              .from('departamentos')
              .insert(insertPayload)
              .select();
            if (error) throw error;
            if (data) savedDepts = [...savedDepts, ...data];
          }
          
          setConfig(prev => {
            const currentList = prev.departamentos || [];
            const savedMap = new Map(savedDepts.map((d: any) => [d.id, d]));
            
            // Map the inserted back to temp by exact index order for correlation
            const newlyInsertedDepts = savedDepts.filter((d: any) => 
               !updatePayload.some(u => u.id === d.id)
            );
            const tempItems = currentList.filter((d: any) => typeof d.id === 'string' && d.id.startsWith('temp-'));
            
            const mergedList = currentList.map((item: any) => {
              if (typeof item.id === 'string' && item.id.startsWith('temp-')) {
                const tempIndex = tempItems.findIndex((t: any) => t.id === item.id);
                if (tempIndex >= 0 && tempIndex < newlyInsertedDepts.length) {
                  return { ...newlyInsertedDepts[tempIndex] };
                }
                return item;
              }
              return savedMap.has(item.id) ? savedMap.get(item.id) : item;
            });

            const mergedIds = new Set(mergedList.map((i: any) => i.id));
            const extraItems = savedDepts.filter((d: any) => !mergedIds.has(d.id));

            return { ...prev, departamentos: [...mergedList, ...extraItems] };
          });
        } else {
          setConfig(prev => ({ ...prev, departamentos: [] }));
        }
      }

      console.log('--- SAVING CERTIFICACOES ---');
      if (certificacoes) {
        if (certificacoes.length > 0) {
          const sanitizedCerts = sanitizeDepartamentos(certificacoes);

          const updatePayload = sanitizedCerts
            .filter(c => c.id)
            .map(({ _temp_id, ...c }) => c);

          const insertPayload = sanitizedCerts
            .filter(c => !c.id)
            .map(({ id, _temp_id, ...c }) => c);

          let savedCerts: any[] = [];

          if (updatePayload.length > 0) {
            console.log('UPDATE PAYLOAD CERT:', updatePayload);
            const { data, error } = await supabase
              .from('certificacoes')
              .upsert(updatePayload, { onConflict: 'id' })
              .select();
            if (error) throw error;
            if (data) savedCerts = [...savedCerts, ...data];
          }

          if (insertPayload.length > 0) {
            console.log('INSERT PAYLOAD CERT:', insertPayload);
            const { data, error } = await supabase
              .from('certificacoes')
              .insert(insertPayload)
              .select();
            if (error) throw error;
            if (data) savedCerts = [...savedCerts, ...data];
          }
          
          setConfig(prev => {
            const currentList = prev.certificacoes || [];
            const savedMap = new Map(savedCerts.map((c: any) => [c.id, c]));
            
            // Map the inserted back to temp by exact index order for correlation
            const newlyInsertedCerts = savedCerts.filter((c: any) => 
               !updatePayload.some(u => u.id === c.id)
            );
            const tempItems = currentList.filter((c: any) => typeof c.id === 'string' && c.id.startsWith('temp-'));

            const mergedList = currentList.map((item: any) => {
              if (typeof item.id === 'string' && item.id.startsWith('temp-')) {
                const tempIndex = tempItems.findIndex((t: any) => t.id === item.id);
                if (tempIndex >= 0 && tempIndex < newlyInsertedCerts.length) {
                  return { ...newlyInsertedCerts[tempIndex] };
                }
                return item;
              }
              return savedMap.has(item.id) ? savedMap.get(item.id) : item;
            });

            const mergedIds = new Set(mergedList.map((i: any) => i.id));
            const extraItems = savedCerts.filter((c: any) => !mergedIds.has(c.id));

            return { ...prev, certificacoes: [...mergedList, ...extraItems] };
          });
        } else {
          setConfig(prev => ({ ...prev, certificacoes: [] }));
        }
      }
      
      setSaveMessage({ show: true, text: 'Configurações salvas com sucesso!', type: 'success' });
    } catch (error) {
      console.error('Erro ao salvar configurações:', error);
      alert('Erro ao salvar configurações');
      setSaveMessage({ show: true, text: 'Erro ao salvar configurações.', type: 'error' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMessage({ show: false, text: '', type: 'success' }), 3000);
    }
  };

  const [testingEmail, setTestingEmail] = useState(false);
  const [activeTab, setActiveTab] = useState('email');

  const TABS = [
    { id: 'email', label: 'E-mail', icon: Mail },
    { id: 'templates', label: 'Templates', icon: Mail },
    { id: 'vagas', label: 'Vagas (Campos)', icon: Briefcase },
    { id: 'regras', label: 'Regras de Negócio', icon: Settings }
  ];

  const handleTestEmail = async () => {
    const emailDestino = prompt('Informe o e-mail para teste:');
    if (!emailDestino) return;

    setTestingEmail(true);
    try {
      const { data: result, ok } = await safeFetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailDestino,
          subject: 'Teste de envio de e-mail - Recruta AÍ',
          body: 'Este é um e-mail de teste para validar o serviço de envio configurado no servidor do Recruta AÍ.',
          
        })
      });

      if (ok) {
        alert('✔ E-mail de teste enviado com sucesso! Verifique sua caixa de entrada.');
      } else {
        const errorMsg = result.message || result.error || 'Erro desconhecido';
        alert(`❌ Erro ao enviar e-mail (${result.error_type || 'ERRO'}): ${errorMsg}\n\nDetalhes: ${result.details || 'Sem detalhes'}`);
      }
    } catch (error: any) {
      console.error('Erro no teste de e-mail:', error);
      alert('Erro ao realizar o teste de e-mail. Verifique o console.');
    } finally {
      setTestingEmail(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center p-12">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">Configurações do Sistema</h1>
        {saveMessage.show && (
          <div className={`px-4 py-2 rounded-lg text-sm font-medium ${saveMessage.type === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
            {saveMessage.text}
          </div>
        )}
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex flex-wrap gap-2 p-1.5 bg-[#F1F5F9] rounded-2xl w-fit border border-[#E2E8F0] shadow-sm">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-8 py-3.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all duration-300 ${
                activeTab === tab.id
                  ? 'bg-white text-[#0054A6] shadow-md ring-1 ring-[#0054A6]/20'
                  : 'text-[#4D4D4D] hover:text-[#1A1A1A] hover:bg-white/40'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'text-[#0054A6]' : ''}`} />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-h-[400px]">
          {activeTab === 'email' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Mail className="w-5 h-5 text-primary" />
                  Serviço de E-mail
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  O envio de e-mails é controlado pelo servidor e pelas credenciais de ambiente. Nenhuma credencial de transporte é armazenada ou enviada pelo navegador.
                </p>
                <button
                  type="button"
                  onClick={handleTestEmail}
                  disabled={testingEmail}
                  className="mt-4 flex items-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
                >
                  <Mail className="w-4 h-4" />
                  {testingEmail ? 'Enviando teste...' : 'Testar Envio de E-mail'}
                </button>
                <div className="p-6 mt-6 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-sm font-medium text-slate-700">Configuração segura</p>
                  <p className="text-sm text-slate-500 mt-1">
                    API key, remetente e demais credenciais permanecem exclusivamente no backend.
                  </p>
                </div>              </div>
            </div>
          )}

          {activeTab === 'templates' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    Template de Notificação de Mensagem
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Personalize o e-mail que o candidato recebe quando o RH envia uma mensagem.</p>
                  <div className="mt-2 text-xs text-slate-500 bg-slate-100 p-2 rounded border border-slate-200">
                    <strong>Variáveis disponíveis:</strong> [Nome do Candidato], [Título da Vaga]
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assunto do E-mail</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FileText className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        name="emailTemplateSubject"
                        value={config.emailTemplateSubject}
                        onChange={handleChange}
                        className="pl-10 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Corpo do E-mail</label>
                    <textarea
                      name="emailTemplateBody"
                      value={config.emailTemplateBody}
                      onChange={handleChange}
                      rows={8}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-sans"
                    ></textarea>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="p-6 border-b border-slate-200 bg-slate-50">
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-primary" />
                    Template de Convite para Candidatura
                  </h2>
                  <p className="text-sm text-slate-500 mt-1">Permite configurar o e-mail enviado ao convidar um candidato do banco de talentos para uma vaga.</p>
                  <div className="mt-2 text-xs text-slate-500 bg-slate-100 p-2 rounded border border-slate-200">
                    <strong>Variáveis disponíveis:</strong> [Nome do Candidato], [Título da Vaga], [Nome da Empresa]
                  </div>
                </div>
                <div className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Assunto do E-mail</label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FileText className="h-4 w-4 text-slate-400" />
                      </div>
                      <input
                        type="text"
                        name="inviteTemplateSubject"
                        value={config.inviteTemplateSubject}
                        onChange={handleChange}
                        className="pl-10 w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Corpo do E-mail</label>
                    <textarea
                      name="inviteTemplateBody"
                      value={config.inviteTemplateBody}
                      onChange={handleChange}
                      rows={8}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-sans"
                    ></textarea>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vagas' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-primary" />
                  Parâmetros de Campos de Vagas
                </h2>
                <p className="text-sm text-slate-500 mt-1">Configure as listas de opções utilizadas nos formulários de vagas.</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Departamentos */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-slate-700">Departamento / Área</label>
                    <button
                      type="button"
                      onClick={() => handleAddListItem('departamentos')}
                      className="text-xs flex items-center gap-1 text-primary hover:text-accent font-medium"
                    >
                      <Plus className="w-3 h-3" /> Adicionar novo
                    </button>
                  </div>
                  <div className="space-y-2">
                    {config.departamentos?.map((dept: any, index: number) => (
                      <ListItem
                        key={dept.id}
                        item={dept}
                        index={index}
                        listName="departamentos"
                        onUpdate={handleUpdateListItem}
                        onDelete={handleDeleteListItem}
                        onMove={handleMoveListItem}
                        showOrder={true}
                        totalItems={config.departamentos.length}
                      />
                    ))}
                  </div>
                </div>

                {/* Certificações */}
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <label className="block text-sm font-medium text-slate-700">Certificações Desejadas / Obrigatórias</label>
                    <button
                      type="button"
                      onClick={() => handleAddListItem('certificacoes')}
                      className="text-xs flex items-center gap-1 text-primary hover:text-accent font-medium"
                    >
                      <Plus className="w-3 h-3" /> Adicionar novo
                    </button>
                  </div>
                  <div className="space-y-2">
                    {config.certificacoes?.map((cert: any, index: number) => (
                      <ListItem
                        key={cert.id}
                        item={cert}
                        index={index}
                        listName="certificacoes"
                        onUpdate={handleUpdateListItem}
                        onDelete={handleDeleteListItem}
                        showOrder={false}
                        totalItems={config.certificacoes.length}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'regras' && (
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-6 border-b border-slate-200 bg-slate-50">
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-primary" />
                  Parâmetros de Regras de Negócio
                </h2>
                <p className="text-sm text-slate-500 mt-1">Configure as regras dinâmicas do sistema.</p>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {regrasSchema.map(regra => (
                  <div key={regra.id}>
                    <label className="block text-sm font-medium text-slate-700 mb-1">{regra.label}</label>
                    <p className="text-xs text-slate-500 mb-2">{regra.description}</p>
                    <div className="relative flex items-center">
                      <input
                        type={regra.type}
                        name={regra.id}
                        value={config[regra.id] ?? regra.defaultValue}
                        onChange={handleChange}
                        className={`w-full px-3 py-2 border border-slate-300 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary ${regra.unit ? 'rounded-l-lg' : 'rounded-lg'}`}
                      />
                      {regra.unit && (
                        <span className="bg-slate-100 border border-l-0 border-slate-300 px-3 py-2 rounded-r-lg text-slate-600 text-sm">{regra.unit}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        <div className="flex justify-end pt-6 border-t border-slate-200">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-medium hover:bg-accent transition-colors disabled:opacity-50 shadow-sm"
          >
            <Save className="w-5 h-5" />
            {saving ? 'Salvando...' : 'Salvar Configurações'}
          </button>
        </div>
      </form>

    </div>
  );
}
