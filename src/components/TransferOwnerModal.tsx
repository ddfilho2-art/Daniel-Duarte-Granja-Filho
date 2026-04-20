import React, { useState, useEffect } from 'react';
import { X, Calendar, AlertTriangle, History, CheckCircle2, UserPlus, Repeat } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { logAudit } from '../lib/audit';

interface TransferOwnerModalProps {
  isOpen: boolean;
  onClose: () => void;
  vaga: any;
  onSuccess: () => void;
}

export function TransferOwnerModal({ isOpen, onClose, vaga, onSuccess }: TransferOwnerModalProps) {
  const { profile } = useAuth();
  const [type, setType] = useState<'Temporária' | 'Definitiva'>('Temporária');
  const [rhUsers, setRhUsers] = useState<any[]>([]);
  const [newOwnerId, setNewOwnerId] = useState('');
  const [justification, setJustification] = useState('');
  const [loading, setLoading] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Temporary Transfer Fields
  const [absenceReason, setAbsenceReason] = useState('Férias');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [autoReturn, setAutoReturn] = useState(true);

  // Definitive Transfer Fields
  const [terminationReason, setTerminationReason] = useState('Desligamento pela empresa');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    if (isOpen) {
      fetchRhUsers();
    }
  }, [isOpen, vaga.ownerId]);

  const fetchRhUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('perfil', 'RH')
        .eq('status', 'Ativo');
      
      if (error) throw error;
      
      const users = (data || []).filter((u: any) => u.id !== vaga.owner_id);
      setRhUsers(users);
    } catch (error) {
      console.error('Erro ao buscar usuários RH:', error);
    }
  };

  const fetchHistory = async () => {
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from('transferencias')
        .select('*')
        .eq('vaga_id', vaga.id)
        .order('data_execucao', { ascending: false });
      
      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Erro ao buscar histórico:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleConfirm = async () => {
    if (!newOwnerId || justification.length < 20) return;
    
    // Validations
    if (type === 'Temporária') {
      if (!startDate || !endDate) {
        alert('Por favor, preencha as datas de início e retorno.');
        return;
      }
      
      const start = new Date(startDate + 'T00:00:00');
      const end = new Date(endDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (end <= start) {
        alert('A data de retorno deve ser posterior à data de início da ausência.');
        return;
      }
      
      if (start < today) {
        alert('A data de início não pode ser anterior à data atual.');
        return;
      }
    } else {
      if (!effectiveDate) {
        alert('Por favor, preencha a data de efetivação.');
        return;
      }
      if (new Date(effectiveDate) > new Date()) {
        alert('A data de efetivação não pode ser uma data futura.');
        return;
      }
    }

    setShowConfirmation(true);
  };

  const executeTransfer = async () => {
    setLoading(true);
    try {
      const newOwner = rhUsers.find(u => u.id === newOwnerId);
      if (!newOwner) throw new Error('Novo proprietário não encontrado.');

      const transferData: any = {
        vaga_id: vaga.id,
        data_execucao: new Date().toISOString(),
        tipo: type,
        proprietario_anterior_id: vaga.owner_id || null,
        proprietario_anterior_nome: vaga.owner_nome || 'Sem proprietário',
        novo_proprietario_id: newOwner.id,
        novo_proprietario_nome: newOwner.nome,
        justificativa: justification,
        executado_por_id: profile?.uid || 'unknown',
        executado_por_nome: profile?.nome || 'unknown'
      };

      if (type === 'Temporária') {
        transferData.motivo_ausencia = absenceReason;
        transferData.data_inicio = startDate;
        transferData.data_retorno = endDate;
        transferData.retorno_automatico = autoReturn;
      } else {
        transferData.motivo_desligamento = terminationReason;
        transferData.data_efetivacao = effectiveDate;
      }

      console.log('[DEBUG-DB] 1. DADOS DE ENTRADA (Transferência):', transferData);

      // 1. Add to history (Non-blocking as per Flow Check)
      try {
        const { error: historyError } = await supabase
          .from('transferencias')
          .insert(transferData);
        
        if (historyError) {
          console.error('[ERRO-REAL] Falha no Insert de Histórico:', {
            message: historyError.message,
            details: historyError.details,
            hint: historyError.hint
          });
          // Não lançamos erro aqui para permitir que a mudança de dono ocorra
        } else {
          console.log('[DEBUG-DB] SUCESSO na gravação do histórico.');
        }
      } catch (err) {
        console.error('[ERRO-REAL] Exceção ao gravar histórico:', err);
      }

      // 2. Update vaga
      const patchData = { 
        owner_id: newOwner.id,
        owner_nome: newOwner.nome,
        transferencia_ativa: type === 'Temporária',
        transferencia_tipo: type,
        transferencia_temporaria: type === 'Temporária' ? {
          original_owner_id: vaga.owner_id || null,
          original_owner_nome: vaga.owner_nome || 'Sem proprietário',
          data_retorno: endDate,
          auto_retorno: autoReturn
        } : null,
        updated_at: new Date().toISOString()
      };

      console.log('[DEBUG-DB] 1. DADOS DE ENTRADA (PATCH Vaga):', patchData);

      const { data, error, count } = await supabase
        .from('vagas')
        .update(patchData)
        .eq('id', vaga.id)
        .select();

      if (error) {
        console.error('[ERRO-REAL] Falha no PATCH Vagas:', {
          message: error.message,
          details: error.details,
          hint: error.hint
        });
        alert('Erro ao atualizar banco: ' + error.message);
        return;
      }
      
      console.log('[DEBUG-DB] SUCESSO no update da vaga.');
      console.log('[DEBUG-DB] 3. RESPOSTA DO SERVIDOR (PATCH):', { data, error, count });

      // [INÍCIO DO BLOCO DE INSPEÇÃO]
      console.log('[DEBUG-QUERY] 2. A QUERY (Verificação de Sincronização): select owner_nome where id =', vaga.id);
      const { data: verify, error: verifyError } = await supabase.from('vagas').select('owner_nome').eq('id', vaga.id).single();
      
      if (verifyError) {
        console.error('[ERRO-REAL] Falha na Verificação:', verifyError);
      }

      const syncSuccess = verify?.owner_nome === newOwner.nome;
      console.log('[DEBUG-UI] 4. REGRA DE NEGÓCIO PARA RENDERIZAÇÃO (Sync Check):', { syncSuccess, expected: newOwner.nome, actual: verify?.owner_nome });

      if (syncSuccess) {
        alert('Sucesso: Banco sincronizado.');
        onSuccess?.(); // Chamada explícita de refresh (via Admin.tsx)
        onClose();
      } else {
        console.error('[DEBUG-UI] 6. O GARGALO DE ATUALIZAÇÃO: Falha de Persistência Detectada');
        alert('Erro de Sincronização: O banco não refletiu a mudança. Forçando recarregamento.');
        window.location.reload();
      }
      // [FIM DO BLOCO DE INSPEÇÃO]
    } catch (error: any) {
      console.error('[ERRO-REAL] Erro Crítico no Fluxo:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        error
      });
      alert(error.message || 'Erro ao executar transferência. Verifique as permissões.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Transferir Proprietário</h3>
            <p className="text-sm text-slate-500">Vaga: {vaga.titulo} ({vaga.codigo_vaga || '-'})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-left">
          {/* Vaga Info */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200 text-sm">
            <div>
              <p className="text-slate-500 font-medium">Proprietário Atual</p>
              <p className="text-slate-900 font-bold">{vaga.owner_nome || 'Sem proprietário'}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Status</p>
              <p className="text-slate-900 font-bold">{vaga.status}</p>
            </div>
            <div>
              <p className="text-slate-500 font-medium">Fase Atual</p>
              <p className="text-slate-900 font-bold">Processo Seletivo</p>
            </div>
          </div>

          {/* Type Selection */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-lg">
            <button
              onClick={() => setType('Temporária')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${type === 'Temporária' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Temporária
            </button>
            <button
              onClick={() => setType('Definitiva')}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${type === 'Definitiva' ? 'bg-white text-primary shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Definitiva
            </button>
          </div>

          {/* Common Fields */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Novo Proprietário</label>
              <select
                value={newOwnerId}
                onChange={(e) => setNewOwnerId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              >
                <option value="">Selecione um colaborador RH...</option>
                {rhUsers.map(user => (
                  <option key={user.id} value={user.id}>{user.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="block text-sm font-medium text-slate-700">Justificativa</label>
                <span className={`text-[10px] ${justification.length < 20 ? 'text-red-500' : 'text-emerald-500'}`}>
                  {justification.length}/20 caracteres mínimos
                </span>
              </div>
              <textarea
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                placeholder="Descreva o motivo da transferência de proprietário..."
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary min-h-[100px]"
              />
            </div>
          </div>

          {/* Specific Fields */}
          {type === 'Temporária' ? (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da Ausência</label>
                  <select
                    value={absenceReason}
                    onChange={(e) => setAbsenceReason(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="Férias">Férias</option>
                    <option value="Afastamento médico / Licença saúde">Afastamento médico / Licença saúde</option>
                    <option value="Licença maternidade / paternidade">Licença maternidade / paternidade</option>
                    <option value="Licença pessoal">Licença pessoal</option>
                    <option value="Outros (ausência temporária)">Outros (ausência temporária)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Início</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data Prevista de Retorno</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoReturn}
                    onChange={(e) => setAutoReturn(e.target.checked)}
                    className="w-4 h-4 text-primary border-slate-300 rounded focus:ring-primary"
                  />
                  <span className="text-sm text-slate-700 font-medium">Retornar automaticamente ao proprietário original na data de retorno prevista.</span>
                </label>
                <p className="text-xs text-slate-500 ml-6">
                  Caso o colaborador não retorne na data prevista, o Admin poderá ajustar a data de retorno ou converter para transferência definitiva.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Motivo da Transferência Definitiva</label>
                  <select
                    value={terminationReason}
                    onChange={(e) => setTerminationReason(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  >
                    <option value="Desligamento pela empresa">Desligamento pela empresa</option>
                    <option value="Pedido de demissão">Pedido de demissão</option>
                    <option value="Aposentadoria">Aposentadoria</option>
                    <option value="Falecimento">Falecimento</option>
                    <option value="Outros (saída definitiva)">Outros (saída definitiva)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Data de Efetivação</label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>

              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
                <p className="text-xs text-amber-800">
                  <strong>Atenção:</strong> A transferência definitiva não pode ser desfeita automaticamente. O proprietário original perderá o acesso às ações desta vaga. Para reverter, será necessária uma nova transferência manual.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50 flex justify-between items-center">
          <button
            onClick={() => {
              setShowHistory(true);
              fetchHistory();
            }}
            className="flex items-center gap-2 text-sm text-slate-600 hover:text-primary font-medium transition-colors"
          >
            <History className="w-4 h-4" /> Ver Histórico
          </button>
          <div className="flex gap-4">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleConfirm}
              disabled={!newOwnerId || justification.length < 20}
              className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Confirmar Transferência
            </button>
          </div>
        </div>
      </div>

      {/* Secondary Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <h4 className="text-lg font-bold text-slate-900 mb-4">Confirmar Transferência</h4>
            <p className="text-slate-600 mb-6">
              {type === 'Temporária' ? (
                <>Você está transferindo temporariamente a vaga <strong>{vaga.titulo}</strong> de <strong>{vaga.owner?.nome || vaga.owner_nome}</strong> para <strong>{rhUsers.find(u => u.id === newOwnerId)?.nome}</strong> até <strong>{new Date(endDate).toLocaleDateString('pt-BR')}</strong>. Deseja continuar?</>
              ) : (
                <>Você está transferindo definitivamente a vaga <strong>{vaga.titulo}</strong> de <strong>{vaga.owner?.nome || vaga.owner_nome}</strong> para <strong>{rhUsers.find(u => u.id === newOwnerId)?.nome}</strong>. Esta ação não pode ser desfeita automaticamente. Deseja continuar?</>
              )}
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmation(false)}
                className="px-4 py-2 text-slate-600 font-medium hover:bg-slate-100 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={executeTransfer}
                disabled={loading}
                className="px-4 py-2 bg-primary text-white font-medium rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
              >
                {loading ? 'Processando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* History Modal */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h4 className="text-lg font-bold text-slate-900">Histórico de Transferências</h4>
              <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {loadingHistory ? (
                <div className="text-center py-8 text-slate-500">Carregando histórico...</div>
              ) : history.length === 0 ? (
                <div className="text-center py-8 text-slate-500">Nenhuma transferência registrada.</div>
              ) : (
                <div className="space-y-4">
                  {history.map((item) => (
                    <div key={item.id} className="p-4 border border-slate-200 rounded-lg bg-slate-50 space-y-2 text-left">
                      <div className="flex justify-between items-start">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          item.tipo === 'Temporária' ? 'bg-blue-100 text-blue-700' : 
                          item.tipo === 'Definitiva' ? 'bg-purple-100 text-purple-700' :
                          'bg-emerald-100 text-emerald-700'
                        }`}>
                          {item.tipo}
                        </span>
                        <span className="text-xs text-slate-400">
                          {item.data_execucao ? new Date(item.data_execucao).toLocaleString('pt-BR') : '-'}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-slate-500 text-xs">De</p>
                          <p className="font-medium">{item.proprietario_anterior_nome}</p>
                        </div>
                        <div>
                          <p className="text-slate-500 text-xs">Para</p>
                          <p className="font-medium">{item.novo_proprietario_nome}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Motivo</p>
                        <p className="text-sm">{item.motivo_ausencia || item.motivo_desligamento || 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-slate-500 text-xs">Justificativa</p>
                        <p className="text-sm italic text-slate-700">"{item.justificativa}"</p>
                      </div>
                      {item.tipo === 'Temporária' && (
                        <div className="grid grid-cols-2 gap-4 text-xs pt-2 border-t border-slate-200">
                          <p><span className="text-slate-500">Período:</span> {new Date(item.data_inicio).toLocaleDateString('pt-BR')} a {new Date(item.data_retorno).toLocaleDateString('pt-BR')}</p>
                          <p><span className="text-slate-500">Retorno Automático:</span> {item.retorno_automatico ? 'Sim' : 'Não'}</p>
                        </div>
                      )}
                      <div className="text-[10px] text-slate-400 pt-1">
                        Executado por: {item.executado_por_nome}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
