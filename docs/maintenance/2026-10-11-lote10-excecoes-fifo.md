# Lote 10 — exceções justificadas à fila FIFO

**Status: em progresso — implementação versionada; não validada.**

## Implementado

- Migration 20261011110000_clinic_priority_queue_admin_rpc.sql adiciona listagem da fila disponível para administradores da clínica selecionada, com dados operacionais mínimos.
- A listagem exige associação ativa de clinic_admin no tenant clínico e retorna apenas encaminhamentos não cancelados e ainda não atribuídos.
- A tela de Operação Clínica inclui painel administrativo para priorizar um encaminhamento com justificativa ou remover a exceção.
- A RPC set_medical_referral_priority já exige justificativa mínima e grava histórico/auditoria; a interface chama essa RPC e atualiza a fila.
- A priorização não modifica fifo_original_at: a ordem FIFO original permanece preservada para rastreabilidade.

## Pendências

| Etapa | Status | Detalhe |
|---|---|---|
| Listagem restrita de fila para administrador | Implementado no código — não validado | RPC list_clinic_priority_queue |
| Priorizar/remover exceção com justificativa | Implementado no código — não validado | Integração com set_medical_referral_priority |
| Isolamento por clínica e trilha de auditoria | Implementado no código — não validado | Confirmar com testes negativos no fim |
| Build/type-check/testes | Adiado para a etapa final | Não executar nesta fase |
| Plano integrado de testes | Planejado para a etapa final | Cobrir perfil não admin, tenant cruzado, justificativa ausente e preservação FIFO |
| Aplicar migration / merge / deploy | Não iniciado | Nenhuma ação remota sem autorização |

Nenhum teste ou build foi executado. Supabase remoto e Vercel permanecem intocados.
