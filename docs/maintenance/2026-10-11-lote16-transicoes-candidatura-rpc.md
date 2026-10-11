# Lote 16 — centralização e proteção das transições de candidatura

**Status: implementação concluída — não validada.**

## Objetivo

Alinhar a interface de RH, a RPC `rpc_atualizar_candidatura_processo` e as proteções de banco de dados para que a fase `Contratado` e o status canônico `Contratado` sejam gravados juntos, e para que os caminhos comuns de atualização não reabram candidaturas terminais.

## Diagnóstico

A inspeção encontrou múltiplos caminhos de escrita em `src/pages/HR.tsx`:

- Modal de perfil: atualização direta de `candidaturas`.
- Ação em massa: atualização direta; quando a fase era `Contratado`, o status era `APROVADA`.
- Ação individual: atualização direta e, em algumas situações, reprovação sem fase `Encerrado`.
- Salvamento do fluxo de entrevistas: já chamava a RPC, mas ainda atribuía `APROVADA` à fase `Contratado`.
- Encaminhamento para exame: atualização direta da fase após criar o encaminhamento.

A RPC original verificava autenticação, tenant e papel, mas não impedia estados finais incoerentes nem bloqueava a reabertura de uma candidatura terminal.

## Alterações realizadas

### Banco de dados

Criada a migration versionada `supabase/migrations/20261011150000_harden_candidatura_process_transition.sql`, que redefine `rpc_atualizar_candidatura_processo` para:

- Exigir usuário autenticado e papel ativo de RH/administrador autorizado no tenant corrente.
- Bloquear candidatura inexistente e inconsistência entre candidatura, vaga e tenant.
- Bloquear alterações em candidaturas contratadas, reprovadas, desistentes ou encerradas.
- Exigir fase e status `Contratado` juntos.
- Exigir fase `Encerrado` para status `REPROVADA`.
- Reservar desistência/cancelamento para operação específica.
- Manter a proteção existente do trigger para exame admissional apto e limite concorrente de vagas.
- Revogar execução de `PUBLIC` e `anon` e conceder execução a `authenticated`.
- Criar o trigger `guard_candidatura_transition_write` para impedir alterações diretas de fase/status por candidatos ou usuários sem papel RH autorizado, inclusive quando a chamada tenta contornar a RPC.
- Impor coerência de fase/status no nível da tabela, impedir reabertura de estados terminais e exigir justificativa e auditoria correspondente para registrar desistência.
- Redefinir `rpc_cancelar_candidatura_rh` para gravar a auditoria antes da atualização; se a atualização falhar, a transação também desfaz o registro de auditoria.

### Interface de RH

Em `src/pages/HR.tsx`:

- Modal de perfil, ações em massa, ação individual e encaminhamento para exame passam pela RPC de transição em vez de atualizar diretamente fase/status.
- A última etapa configurada (`Contrato`) agora avança para a fase final canônica `Contratado`, em vez de `Finalizado` sem status de contratação.
- A ação legada da fase `Exame` é tratada como decisão final de contratação; a proteção de banco exige que exista encaminhamento admissional vinculado, apto e não cancelado.
- A ação em massa reconhece a aprovação da última etapa (`Contrato`) e registra fase/status `Contratado` juntos.
- Todas as rotas que avançam à fase `Contratado` enviam o status canônico `Contratado`.
- A reprovação da ação individual é encerrada na fase `Encerrado`, em alinhamento com a regra do banco.
- O caminho de salvamento de entrevista mantém a chamada à RPC e usa o status canônico.

As atualizações não relacionadas à transição de fase/status, como marcação de visualização, não foram convertidas nesta manutenção.

## Dependências e limites

- A migration está apenas versionada na branch; não foi aplicada ao Supabase remoto.
- A proteção de exame e headcount depende da migration do Lote 1 estar aplicada no ambiente em que o fluxo for validado.
- Registros legados incoerentes não foram modificados.
- O trigger protege alterações de fase/status mesmo nos caminhos diretos restantes; ainda é necessário terminar o inventário de clientes/rotas e revisar políticas SQL/RLS para confirmar todos os campos e caminhos de escrita.
- A ação de desistência permanece na RPC dedicada `rpc_cancelar_candidatura_rh`.
- Nenhum teste, build, type-check ou E2E foi executado, conforme orientação de deixar a validação para o final.
- Não houve aplicação de migration remota, merge, pull request ou deploy.

## Validação integrada posterior

No final da etapa de implementação, testar pelo menos:

1. Aprovação intermediária conserva a fase/status esperado.
2. Aprovação a partir de `Exame` e da última etapa `Contrato` só conclui a contratação quando o banco confirma exame admissional apto.
3. Fase `Contratado` sem status `Contratado` é rejeitada.
4. Status `Contratado` fora da fase final é rejeitado.
5. Contratação sem exame admissional apto é rejeitada pelo banco.
6. Duas contratações simultâneas para a última posição não excedem o headcount.
7. Reprovação gera fase `Encerrado` e não pode ser reaberta pela RPC genérica.
8. Desistência exige justificativa, grava auditoria e não ocupa posição.
9. Usuário de outro tenant ou sem papel autorizado não consegue atualizar a candidatura.
10. Ações em massa tratam falhas individuais sem apresentar contagem enganosa de sucesso.
11. Indicadores de vaga e dashboard usam o status canônico, e registros legados divergentes são apenas reportados até existir plano aprovado de reconciliação.

**Ambiente remoto:** intocado.  
**Testes:** adiados para o final.  
**Merge/PR/deploy:** não realizados.
