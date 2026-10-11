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

- Exigir usuário autenticado e contexto do tenant corrente; preservar a permissão de `is_platform_master_admin()` já prevista na RPC anterior, além dos papéis RH/administradores do tenant. O trigger da tabela replica a mesma autorização para impedir bypass por UPDATE direto.
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
- A reprovação comum encerra a candidatura na fase `Encerrado`; na fase legada `Exame`, a reprovação retorna a candidatura para `Entrevista RH`, conforme o rótulo da interface. A aprovação dessa fase leva à decisão final, sempre sujeita ao exame admissional apto no banco.
- O caminho de salvamento de entrevista mantém a chamada à RPC e usa o status canônico.

As atualizações não relacionadas à transição de fase/status, como marcação de visualização, não foram convertidas nesta manutenção.

## Dependências e limites

- A migration está apenas versionada na branch; não foi aplicada ao Supabase remoto.
- A proteção de exame e headcount depende da migration do Lote 1 estar aplicada no ambiente em que o fluxo for validado.
- Registros legados incoerentes não foram modificados.
- O inventário do código cliente e das Edge Functions de candidatura foi concluído nesta revisão estática: em `HR.tsx`, a escrita direta restante na tabela `candidaturas` é somente para `visualizado`/marcação de leitura; em `Candidate.tsx`, a única atualização direta localizada está comentada e não é executável; `Public.tsx`, `HRDetalheVaga.tsx` e `HRRelatorios.tsx` não alteram fase/status de candidaturas; as Edge Functions de candidatura inspecionadas não mostraram escrita direta de fase/status. O trigger continua sendo a proteção de banco contra bypass. **Pendente:** revisar integralmente políticas SQL/RLS e outros consumidores externos; essa revisão estática não equivale a teste nem comprova o comportamento em runtime.
- A ação de desistência permanece na RPC dedicada `rpc_cancelar_candidatura_rh`.
- Nenhum teste, build, type-check ou E2E foi executado, conforme orientação de deixar a validação para o final.
- Não houve aplicação de migration remota, merge, pull request ou deploy.

## Revisão estática adicional de autorização

Na comparação com a migration anterior `20260927130000_rpc_candidatura_tenant_isolation.sql`, foi identificado que ela também autorizava `is_platform_master_admin()` no tenant selecionado. A primeira versão do endurecimento havia removido essa exceção. O bloco de autorização da RPC e o trigger foram corrigidos para preservar o acesso do administrador master sem remover a exigência de contexto do tenant corrente. **Ainda não validado em runtime.**

## Inventário complementar de escritas

- `src/pages/HR.tsx`: chamadas de transição identificadas usam `rpc_atualizar_candidatura_processo`; atualização direta remanescente encontrada marca apenas campos de visualização/leitura.
- `src/pages/Candidate.tsx`: atualização direta antiga de `candidaturas` está em comentário, sem execução; as demais ocorrências relevantes são leituras.
- `src/pages/Public.tsx`: leituras e verificação de candidatura existente; sem atualização de fase/status.
- `src/pages/HRDetalheVaga.tsx` e `src/pages/HRRelatorios.tsx`: leituras de candidaturas; atualizações observadas são de vagas, não de fase/status de candidatura.
- Edge Functions inspecionadas relacionadas a aplicação/análise não mostraram atualização direta de fase/status. A criação de candidatura deve continuar protegida pelo fluxo de aplicação já existente.
- **Pendente antes de validar:** a revisão estática das policies/ACLs das tabelas-alvo candidaturas e medical_referrals foi concluída nos Lotes 17–18. Continua pendente a revisão global das policies/RLS, triggers relacionados e consumidores externos. Não inferir segurança de runtime somente pela inspeção estática.

## Validação integrada posterior

No final da etapa de implementação, testar pelo menos:

1. Aprovação intermediária conserva a fase/status esperado.
2. Reprovação na fase `Exame` retorna a `Entrevista RH`, enquanto reprovação nas demais fases encerra a candidatura.
3. Aprovação a partir de `Exame` e da última etapa `Contrato` só conclui a contratação quando o banco confirma exame admissional apto.
4. Fase `Contratado` sem status `Contratado` é rejeitada.
5. Status `Contratado` fora da fase final é rejeitado.
6. Contratação sem exame admissional apto é rejeitada pelo banco.
7. Duas contratações simultâneas para a última posição não excedem o headcount.
8. Reprovação gera fase `Encerrado` e não pode ser reaberta pela RPC genérica.
9. Desistência exige justificativa, grava auditoria e não ocupa posição.
10. Usuário de outro tenant ou sem papel autorizado não consegue atualizar a candidatura.
11. Ações em massa tratam falhas individuais sem apresentar contagem enganosa de sucesso.
12. Indicadores de vaga e dashboard usam o status canônico, e registros legados divergentes são apenas reportados até existir plano aprovado de reconciliação.

**Ambiente remoto:** intocado.  
**Testes:** adiados para o final.  
**Merge/PR/deploy:** não realizados.


## Auditoria estática de RLS e superfície de escrita — 2026-10-11

A revisão das migrations históricas encontrou que a policy de UPDATE de candidaturas permite que o dono da candidatura seja elegível para atualização e tem WITH CHECK limitado ao tenant corrente, sem restringir por coluna os campos alteráveis. A migration fundacional não foi localizada como revogando UPDATE de candidaturas para authenticated. Isso significava que a proteção de fase/status via trigger não era suficiente, por si só, para impedir tentativa de alteração direta de outros campos da candidatura. O Lote 18 fecha essa superfície revogando UPDATE direto da tabela para PUBLIC, anon e authenticated e substituindo a marcação de leitura de RH por uma RPC autorizada.

Para medical_referrals, a migration fundacional já revogava todos os privilégios de tabela para PUBLIC, anon e authenticated, concedendo acesso de tabela ao service_role. Assim, a nova revogação explícita de UPDATE no Lote 17 é defesa em profundidade/documentação; a revisão não afirma que havia um bypass ativo de UPDATE por cliente.

**Limite:** esta é revisão estática dos contratos e migrations versionados, não leitura do catálogo real do banco nem teste de grants/owners em homologação. Os lotes 17 e 18 continuam implementados em código, não validados.
