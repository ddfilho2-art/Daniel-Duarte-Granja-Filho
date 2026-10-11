# Lote 18 — Superfície de escrita de candidaturas

- Data: 2026-10-11
- Branch: maintenance/lote-1-integridade-clinica-contratacao-20261010
- Migration: supabase/migrations/20261011170000_harden_candidatura_client_write_surface.sql
- Status: **Implementado em código, não validado**.

## Diagnóstico

O inventário estático anterior apontou a marcação de leitura em src/pages/HR.tsx como o único UPDATE executável de candidaturas remanescente no cliente; a atualização antiga em src/pages/Candidate.tsx está comentada. As transições de fase/status já foram encaminhadas para RPCs autorizadas.

## Alterações

1. Criada a RPC rpc_marcar_candidatura_visualizada(text), SECURITY DEFINER, que exige autenticação, identifica a candidatura, confirma vínculo da vaga com o mesmo tenant, exige tenant corrente e papel RH/administrador ou administrador master no contexto selecionado, e atualiza apenas os campos de marcação de leitura.
2. O cliente RH agora chama a RPC, trata o erro e só atualiza o estado local após a chamada sem erro.
3. A migration revoga UPDATE direto em public.candidaturas para PUBLIC, anon e authenticated. Isso reduz a superfície de escrita do cliente e torna explícito que operações de negócio devem usar RPCs.

## Dependências e riscos

- Antes de aplicar, reconfirmar que não há outros clientes, Edge Functions, jobs ou integrações legítimas que façam UPDATE direto em candidaturas.
- Confirmar owner e privilégios das RPCs SECURITY DEFINER. Elas precisam manter permissão para escrever na tabela depois da revogação do privilégio de cliente.
- O trigger de integridade de fase/status usa auth.uid() e continua sendo uma segunda camada de proteção; processos sem identidade autenticada não devem escrever transições diretamente.
- A migration não foi aplicada ao Supabase remoto. Não houve build, type-check, testes, merge, PR ou deploy.

## Validação integrada final

- [ ] Usuário autenticado tenta UPDATE direto em candidaturas: deve ser negado.
- [ ] RH autorizado marca candidatura como visualizada; os dois marcadores e updated_at são gravados.
- [ ] RH de outro tenant tenta marcar candidatura: deve ser negado.
- [ ] Candidato tenta alterar fase, status, candidato_id, vaga_id ou tenant_id diretamente: deve ser negado.
- [ ] rpc_atualizar_candidatura_processo continua alterando fase/status autorizados.
- [ ] rpc_cancelar_candidatura_rh continua encerrando com justificativa e auditoria.
- [ ] rpc_candidatar_se continua criando candidatura e enfileirando análise.
- [ ] Contratação com exame apto, headcount concorrente e sincronização da contagem continuam íntegros.
- [ ] Todas as escritas externas e jobs são inventariados antes de aplicar a migration.
- [ ] Atualizar documentação com evidência real; aplicar remoto/deploy somente com autorização explícita.

**Situação:** implementação versionada, ainda não validada.


## Descoberta de RLS associada

A policy histórica de UPDATE em candidaturas elegia também o próprio candidato e restringia WITH CHECK principalmente pelo tenant, sem limitar as colunas que ele poderia modificar. O trigger de transição de fase/status protege esses dois campos, mas não é uma proteção geral de todas as colunas. O Lote 18 complementa a defesa revogando UPDATE direto em candidaturas e movendo a única atualização executável de cliente localizada (marcação de leitura do RH) para uma RPC com validação de tenant e papel.

Ainda falta confirmar ACL e owner efetivos das RPCs no banco de homologação, além de reconfirmar todos os escritores externos antes de aplicar a migration.
