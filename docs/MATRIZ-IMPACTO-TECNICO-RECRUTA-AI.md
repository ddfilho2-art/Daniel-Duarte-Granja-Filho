# Matriz de impacto técnico — Recruta AÍ
Data da análise: 2026-10-10
Repositório: `ddfilho2-art/Daniel-Duarte-Granja-Filho`
Supabase: `dmzagrakkduddofkqjhg`

## Escopo e limites

Esta matriz consolida leitura do código versionado e consultas somente leitura ao schema/histórico remoto. Não foram executados testes/build, não foi alterado o banco, não foram publicadas Edge Functions e não houve deploy. Percentuais são de análise/documentação, não de implementação.

## Achados confirmados

1. O histórico remoto tem 110 migrations e termina em `20261009220539`. As 11 migrations com prefixo `20261010...` listadas no GitHub não constam no histórico remoto.
2. O banco remoto `public.vagas` não possui `quantidade_vagas` nem `quantidade_contratada`. A RPC `rpc_candidatar_se` não verifica o limite de posições.
3. A RPC `rpc_atualizar_candidatura_processo` atualiza fase/status sem exigir resultado apto do exame admissional para marcar a candidatura como contrato/contratada.
4. `medical_referrals.legacy_application_id` é texto, sem FK para `candidaturas.id`.
5. O enum `tenant_role` tem `clinic_admin` e `clinic_staff`, mas não tem papel `doctor`.
6. As funções de fila clínica revisadas não isolam exames pelo médico responsável; o modelo não tem responsável médico nem FIFO original imutável.
7. `can_access_medical_referral()` concede acesso a platform master. A Edge Function `storage-authorize` usa essa função para autorizar anexos clínicos.
8. `src/lib/medical-attachments.ts` tenta listar anexos via consulta direta à tabela `medical_referral_attachments`, mas o papel `authenticated` não tem privilégio SELECT nessa tabela.
9. As tabelas de conversa/agenda empresa–clínica e as Edge Functions `google-calendar-appointments`, `tenant-clinic-chat-storage` e `clinic-user-management` não estão presentes/publicadas no Supabase remoto consultado.
10. Não foram encontradas no schema remoto estruturas de catálogo de exames complementares, preços versionados por contrato, itens faturáveis, fechamento ou estorno.
11. O Security Advisor reporta funções SECURITY DEFINER acessíveis a authenticated/anon, tabelas com RLS sem policy e proteção contra senhas vazadas desativada. Cada alerta requer triagem individual; não se deve revogar privilégios em massa sem entender o contrato de uso.

## Matriz por domínio

| Domínio | Estado atual | Mudança recomendada | Dependências e riscos | Aceite obrigatório |
|---|---|---|---|---|
| Contratação e headcount | Quantidade não existe no banco; RPC de candidatura não bloqueia limite; alteração de fase não exige aptidão médica | Operação canônica transacional: travar vaga, validar aptidão associada, impedir excedente, registrar contratação uma vez e auditar ator/data | Mapear todas as escritas de fase/status e reversões; não contar `APROVADA` como contratação; preservar fechamento explícito | Testes concorrentes para última posição; inapto; repetição idempotente; reversão; tentativa por RPC direta |
| Candidatura ↔ admissional | Identificador legado textual sem FK | Adicionar vínculo tipado/validado com backfill auditável e compatibilidade temporária | Resolver órfãos/duplicidades antes de impor integridade; cada candidato pode ter várias candidaturas | Backfill de órfãos, IDs inválidos, outro tenant e múltiplas candidaturas; impedir contratação sem resultado apto vinculado |
| Papéis e fila clínica | Sem papel doctor, responsável atribuído ou FIFO imutável | Papel/capacidade médico explícito; `assigned_doctor_user_id`; claim atômico; `fifo_original_at` imutável; eventos de atribuição/devolução/prioridade | Médico precisa ser membro ativo da clínica; secretaria/admin pode atribuir; agendamento não é atribuição; exceção de FIFO justificada | Dois médicos reivindicando o mesmo item; médico acessando item alheio; membro inativo/outra clínica; devolução preserva FIFO; prioridade sem justificativa é recusada |
| Permissões e Storage clínico | Platform master tem caminho de acesso global; listagem de anexos diverge do ACL | Autorização central por clínica, papel e atribuição; RPC de metadados; bucket privado; URLs assinadas curtas | Rever todos os chamadores antes de mudar função compartilhada; classificar cada SECURITY DEFINER individualmente | Testes positivos/negativos para médico próprio/alheio, secretaria, admin clínico, RH, platform master sem vínculo e outra clínica; validar metadados e arquivo real |
| Chat e agenda empresa–clínica | 11 migrations e 3 funções não sincronizadas com Supabase remoto; agenda ligada à conversa | Release coordenado de migrations, funções, secrets/config e frontend; posteriormente vincular agenda ao encaminhamento/item complementar e responsável | Não publicar frontend que chama objetos inexistentes; testar falhas de sincronização com Google Calendar; não inserir dados clínicos em títulos/eventos | Fluxo completo em homologação, idempotência, conflito concorrente, rollback, autorização e configuração por clínica |
| Exames complementares | Modelo não encontrado | Catálogo por clínica; itens complementares ligados ao encaminhamento, com solicitante, justificativa, estado, agendamento e realização separados | A indicação deriva de PCMSO/riscos e decisão médica; não presumir que todos os exames se aplicam a todos | Vários exames por admissional; cancelamento; solicitado/agendado não realizado; realização e cobrança separados |
| Faturamento | Sem catálogo/preço/fechamento/estorno no schema remoto | Preço por contrato com vigência; ledger de itens elegíveis após realização; fechamento por período/empresa; ajustes/estornos rastreáveis; relatório macro e detalhamento; exportação | Definir falta/no-show/repetição e decisão de integração de boleto; preço fechado não pode ser recalculado com tarifa atual | Macro = soma dos detalhes; sem duplicidade; alteração de preço; estorno/crédito; período vazio; exportação reconciliada |
| Release e regressão | Código e banco dessincronizados; testes/build não executados nesta rodada | Lotes de domínio, migrações compatíveis, testes integrados e deploy manual | Não tratar código no GitHub como funcionalidade já disponível; preservar controle manual de produção | Typecheck/build, testes RPC/RLS/Storage, concorrência, E2E multi-tenant, regressão de cadastro/login/RH e rollback ensaiado |

## Ordem de execução em lotes

1. **Lote 0 — baseline:** fechar inventário GitHub × Supabase, RPCs, ACLs e migrations pendentes. Nenhuma alteração de dados.
2. **Lote 1 — integridade clínica e contratação:** vínculo candidatura/admissional, gate de aptidão, headcount atômico, auditoria e correção de autorização/Storage.
3. **Lote 2 — fila e papéis clínicos:** papel médico, claim atômico, FIFO original, devolução e prioridade justificada.
4. **Lote 3 — complementares e agenda:** catálogo/itens, vínculo com encaminhamento e permissões de secretaria/médico.
5. **Lote 4 — faturamento:** preços versionados, itens realizados faturáveis, fechamento, relatórios, estornos e exportação.
6. **Lote 5 — sincronização do lote empresa–clínica:** revisar e validar migrations/funções pendentes em homologação; publicar em ordem controlada apenas depois da validação.
7. **Lote 6 — validação integrada:** concorrência, isolamento multi-tenant, regressão de cadastro/login/RH, segurança e rollback.

## Regras de negócio consolidadas

- Contratação só conta quando RH confirma contratação e existe resultado apto associado ao encaminhamento admissional correto.
- Inaptidão não ocupa posição; a vaga segue disponível enquanto houver posições não preenchidas e a empresa não a tiver fechado explicitamente.
- Exames complementares são itens individuais do admissional. Solicitar ou agendar não gera cobrança; a cobrança exige realização e elegibilidade comercial.
- Relatórios devem permitir total macro e detalhamento por empresa, contrato e período, reconciliando cada valor.
- Administrador global não ganha acesso clínico apenas por ser administrador.
- A sincronização do lote `20261010...` é um release separado, porque as migrations/funções não estão no Supabase remoto.

## Pendências de negócio que não bloqueiam o desenho inicial

- Definir se boleto será emitido pelo Recruta AÍ ou se o sistema apenas fecha, exporta e registra a cobrança externa.
- Definir política de faturamento para falta/no-show e exames repetidos/cancelados após execução.
- Definir quem pode autorizar exceção de FIFO/prioridade; por padrão, limitar a administrador da clínica e registrar justificativa.
- Definir como registrar reversão de contratação e reabertura de vaga, com trilha de auditoria.


## Complemento da auditoria — chat e agenda (2026-10-10)

A leitura adicional das migrations do lote empresa–clínica identificou três pontos para corrigir antes da publicação:

1. **Idempotência de reserva precisa vincular a chave ao recurso autorizado.** Em `reserve_tenant_clinic_appointment`, após autorizar a conversa recebida, a função consulta a chave de idempotência e retorna o ID encontrado sem confirmar que a reserva existente pertence à mesma conversa/empresa/clínica. A resposta expõe somente o ID, mas o contrato idempotente deve exigir que a chave repetida corresponda à mesma operação e ao mesmo escopo. Ajustar a função para verificar o vínculo e retornar conflito explícito quando a chave for reutilizada em outro contexto.
2. **Bloqueio de conteúdo clínico no chat é apenas heurístico.** A constraint e a RPC barram algumas palavras como laudo, diagnóstico, CID e prontuário, mas não garantem que outras descrições clínicas sejam detectadas. Tratar isso como aviso/defesa em profundidade, não como controle de confidencialidade; a UI deve orientar o usuário e documentos clínicos devem usar fluxo privado com autorização clínica específica.
3. **Constraint redundante de vínculo de encaminhamento.** `tenant_clinic_conversations_referral_pair` testa `medical_referral_id IS NULL OR medical_referral_id IS NOT NULL`, uma condição sempre verdadeira. Ela não valida vínculo algum e pode ser removida ou substituída por regra real quando o modelo de conversa/exame for ajustado.

Esses achados aumentam o escopo do lote de release do chat/agenda: testar reuso de chave entre conversas, autorização em ambos os lados, conteúdo não permitido e anexos privados. Nenhuma migration foi aplicada e nenhuma função foi alterada nesta rodada.
