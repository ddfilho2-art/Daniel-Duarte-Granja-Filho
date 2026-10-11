# Validação integrada — Lotes 16–19 (recrutamento e Saúde Ocupacional)

- Data de preparação: 2026-10-11
- Branch: maintenance/lote-1-integridade-clinica-contratacao-20261010
- Estado: roteiro preparado; **testes de banco/E2E pendentes**.
- CI de código: type-check e build passaram no commit 70cfc6865a7fb74370c972e6205add9deed17f6f.
- Supabase remoto: nenhuma migration aplicada.
- Produção: nenhum deploy realizado.

## 1. Pré-condições

- [ ] Usar ambiente de homologação separado da produção, com duas empresas empregadoras isoladas (A e B), uma clínica prestadora, um RH em cada empresa, um candidato, uma secretaria/admin clínico e dois médicos.
- [ ] Confirmar backups/rollback e listar as migrations pendentes antes de executar SQL.
- [ ] Confirmar owner, SECURITY DEFINER, search_path, EXECUTE grants e privilégios de tabela das RPCs antes de migrar.
- [ ] Aplicar somente em homologação e na ordem cronológica/contratual: Lote 1 de integridade/headcount, desistência RH, Lote 16, Lote 17, Lote 18; incluir previamente as migrations fundacionais necessárias. Não aplicar diretamente em produção.
- [ ] Inspecionar catálogo pós-migration: triggers, funções, grants, RLS, constraints e índices esperados.

## 2. Candidatura e autorização multi-tenant

- [ ] Candidato da empresa A consegue listar somente as próprias candidaturas no tenant A.
- [ ] Candidato da empresa A não lê nem altera candidaturas da empresa B.
- [ ] UPDATE direto em public.candidaturas por anon/authenticated é negado após o Lote 18.
- [ ] RH da empresa A marca candidatura como visualizada pela RPC; visualizado, rh_visualizou_recrutamento e updated_at são atualizados.
- [ ] RH da empresa B não marca candidatura pertencente à empresa A.
- [ ] rpc_candidatar_se continua criando candidatura no tenant da vaga e enfileirando a análise.
- [ ] rpc_atualizar_candidatura_processo aceita transição permitida de RH autorizado e rejeita tenant incorreto, usuário sem papel, fase/status incompatível e estado terminal.
- [ ] Tentativa de alterar fase/status diretamente na tabela é negada; tentativas de alterar candidato_id, vaga_id ou tenant_id diretamente também são negadas pelo privilégio de tabela.
- [ ] Ações em massa: todos os itens com sucesso; item inválido no meio do lote; falha de consulta; falha de RPC; falha ao persistir evento de histórico. O sucesso parcial precisa ser descrito com precisão e somente as falhas ficam selecionadas para nova tentativa.
- [ ] Ação individual e em massa de Reserva geram fase Banco de Talentos e status RESERVA.

## 3. Desistência, reprovação e encerramento

- [ ] Desistência exige justificativa de 5 a 1000 caracteres e autorização RH/admin do tenant.
- [ ] Desistência registra status Desistência, fase Encerrado, motivo e auditoria transacional; falha da atualização desfaz a inserção de auditoria.
- [ ] UPDATE direto tentando fabricar desistência sem auditoria correspondente é negado.
- [ ] Reprovação comum grava REPROVADA + Encerrado.
- [ ] Estado reprovado/desistente/contratado não pode ser reaberto pela RPC genérica.
- [ ] A reprovação da fase legada Exame retorna a Entrevista RH conforme o fluxo de interface, sem fechar como contratado.

## 4. Exame admissional, contratação e headcount

- [ ] Sem encaminhamento admissional apto, status Contratado é negado.
- [ ] Exame inapto, inconclusivo ou cancelado não satisfaz a regra de contratação.
- [ ] Encaminhamento admissional apto e não cancelado permite a contratação autorizada.
- [ ] Encaminhamento deve pertencer à mesma candidatura/tenant da vaga, conforme a regra de vínculo usada pelo trigger.
- [ ] Duas candidaturas concorrentes para a última posição: uma só pode ocupar a vaga; quantidade_contratada nunca excede quantidade_vagas.
- [ ] Desistência, reprovação, agendamento e exame por si só não ocupam posição.
- [ ] Contagem derivada da vaga e dashboard coincidem com candidaturas em status Contratado.
- [ ] Estados legados divergentes são reportados; não corrigir automaticamente sem plano de dados aprovado.

## 5. Fila, atribuição e privacidade clínica

- [ ] Lista disponível contém somente encaminhamentos não atribuídos e não cancelados da clínica selecionada.
- [ ] Dois médicos tentam assumir o mesmo encaminhamento simultaneamente; somente um consegue.
- [ ] Após assumir, o item some da fila disponível para os demais e aparece no painel do médico atribuído.
- [ ] Médico sem papel administrativo não vê exames atribuídos a outro médico; secretaria/admin vê operação da clínica dentro do escopo autorizado.
- [ ] E-mail do candidato é omitido da visão do médico e somente aparece na visão administrativa autorizada.
- [ ] Devolver à fila exige motivo, preserva fifo_original_at e grava histórico/auditoria.
- [ ] Prioridade exige justificativa e trilha de auditoria sem alterar fifo_original_at.
- [ ] Outro tenant/clínica não consegue ler nem assumir o encaminhamento.
- [ ] Acesso a anexos usa autorização por encaminhamento e URL assinada; nenhuma URL assinada/token deve ser registrada em log.

## 6. Máquina de estados do atendimento

- [ ] referred → scheduled exige data/hora e local.
- [ ] scheduled → attended é permitido; qualquer salto/regressão não é.
- [ ] attended → result_reported exige ator autorizado e resultado fit, unfit ou inconclusive.
- [ ] completed exige resultado previamente informado e preserva fitness_result já gravado.
- [ ] Médico não atribuído não registra resultado de exame alheio.
- [ ] Estado completed não pode ser reaberto nem sobrescrito.
- [ ] Agendamento e cancelamento de exame/agendamento são distintos da desistência da candidatura.
- [ ] Cancelamento clínico exige autorização e justificativa conforme as RPCs aplicáveis.

## 7. Critérios de saída

- [ ] Todos os cenários críticos passam em homologação.
- [ ] Contadores e auditoria são reconciliados.
- [ ] Falhas restantes têm evidência, causa e status no TODO/KB.
- [ ] Somente após aprovação explícita, decidir aplicação das migrations em produção, criação de PR/merge e deploy manual.
- [ ] Não chamar os Lotes 16–19 de “validados” antes de concluir este roteiro. CI verde comprova apenas type-check e build.

## Restrições atuais

Nenhuma migration foi aplicada ao Supabase remoto. E2E contra produção não foi executado. Merge/PR/deploy não realizados.
