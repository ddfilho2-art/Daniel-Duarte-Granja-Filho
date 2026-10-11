# Lote 17 — Integridade do ciclo de vida clínico

- Data: 2026-10-11
- Branch: maintenance/lote-1-integridade-clinica-contratacao-20261010
- Repositório: ddfilho2-art/Daniel-Duarte-Granja-Filho
- Migration: supabase/migrations/20261011160000_harden_medical_referral_writes_and_transitions.sql
- Status: **Implementado em código, ainda não validado**.

## Objetivo

Ampliar a manutenção de integridade para além da candidatura, cobrindo a operação clínica e a proteção contra alterações diretas em encaminhamentos médicos.

## Diagnóstico estático

- src/pages/OccupationalHealth.tsx usa list_my_medical_referrals para leitura e update_medical_referral para mudanças de estado.
- src/pages/ClinicOperations.tsx usa RPCs para listar fila por clínica, assumir exame, devolver à fila, priorizar e consultar encaminhamentos.
- As Edge Functions apply-to-vacancy, tenant-clinic-chat-storage e storage-authorize foram inspecionadas quanto a UPDATEs diretos em medical_referrals; nenhum foi localizado nos caminhos revisados.
- A política histórica medical_referrals_update_policy permite UPDATE para membros clínicos ativos. Uma política RLS isolada não impede alteração direta por um membro autorizado pela política; os campos operacionais devem ser alterados por caminhos de negócio controlados.
- list_clinic_referrals_for_complementary_exam filtrava somente os exames do médico quando o mesmo usuário também tinha papel de scheduler. Isso ocultava parte da visão operacional de usuários com papéis combinados.

## Alterações realizadas

### 1. Bloqueio de UPDATE direto

A migration revoga o privilégio UPDATE em public.medical_referrals para PUBLIC, anon e authenticated. O objetivo é centralizar alterações nas RPCs SECURITY DEFINER já existentes, sem remover as permissões do service role.

**Dependência crítica:** antes de aplicar, confirmar que as RPCs têm owner autorizado a escrever e que não há cliente, Edge Function, job ou integração legítima dependente de UPDATE direto. Um escritor não inventariado passará a falhar e deverá ser convertido para RPC.

### 2. Máquina de estados do encaminhamento

A RPC update_medical_referral agora aceita apenas a progressão:

1. referred → scheduled
2. scheduled → attended
3. attended → result_reported
4. result_reported → completed

São rejeitados saltos, regressões e alterações após completed. O agendamento exige data e local. Registrar resultado exige perfil autorizado (administrador clínico ou médico atribuído) e resultado diferente de pending. O resultado e a alteração continuam registrados na auditoria.

### 3. Papéis combinados na listagem clínica

A listagem de exames admissionais para exames complementares permite que o scheduler veja a operação da clínica mesmo se também possuir papel de médico. Usuário sem papel de scheduler continua limitado aos encaminhamentos que lhe foram atribuídos. A RPC list_my_medical_referrals também inclui os encaminhamentos do médico ativo somente quando assigned_doctor_id corresponde ao usuário autenticado.

## Riscos e pontos pendentes

- A revogação de UPDATE ainda não foi testada contra todas as funções, jobs e integrações.
- A sequência estrita pode revelar encaminhamentos legados já existentes fora de ordem. Não corrigir dados legados automaticamente.
- Não foi confirmado em runtime o owner efetivo das funções SECURITY DEFINER.
- A policy RLS histórica não foi removida; o privilégio de tabela é a barreira adicional. Rever grants e policies no banco de homologação antes de aplicar.
- A revisão estática dos principais componentes e de algumas Edge Functions não equivale a um inventário completo de todos os escritores.
- Nenhum build, type-check, teste automatizado ou E2E foi executado nesta etapa.
- A migration não foi aplicada ao Supabase remoto; não houve merge, PR ou deploy.

## Plano de validação integrada final

### A. Acesso e privilégio

- [ ] Usuário autenticado tenta UPDATE direto em medical_referrals: deve ser negado.
- [ ] Usuário anônimo tenta UPDATE: deve ser negado.
- [ ] RPCs de assumir, devolver, priorizar e atualizar continuam funcionando sob seus próprios contratos.
- [ ] Confirmar owner/privileges efetivos das RPCs SECURITY DEFINER.
- [ ] Confirmar que service role e processos internos previstos continuam operacionais.

### B. Máquina de estados

- [ ] referred → scheduled com data e local: sucesso.
- [ ] referred → scheduled sem data ou local: rejeitado.
- [ ] scheduled → attended: sucesso.
- [ ] attended → result_reported com resultado apto/inapto/inconclusivo: sucesso por ator autorizado.
- [ ] Resultado pending: rejeitado.
- [ ] result_reported → completed: sucesso.
- [ ] Saltos de fase, regressão de status e alteração após completed: rejeitados.
- [ ] Médico tenta registrar resultado de encaminhamento atribuído a outro médico: rejeitado.
- [ ] Membro de equipe clínica sem papel autorizado para resultado tenta gravá-lo: rejeitado.

### C. Fila, prioridade e contratação

- [ ] Dois médicos tentam assumir simultaneamente o mesmo encaminhamento: somente um obtém a atribuição.
- [ ] Devolução à fila preserva fifo_original_at, registra motivo e histórico.
- [ ] Prioridade exige justificativa e registra auditoria sem alterar FIFO original.
- [ ] Resultado admissional inapto não permite contratação.
- [ ] Resultado admissional apto permite a decisão de contratação, respeitado o limite concorrente da vaga.
- [ ] Secretaria com papel de scheduler e médico vê a visão operacional permitida; médico sem papel administrativo vê somente os próprios itens.

### D. Regressão e documentação

- [ ] Validar todos os escritores de encaminhamento identificados no inventário completo.
- [ ] Reportar registros legados fora de sequência sem alterar os dados automaticamente.
- [ ] Executar build/type-check/testes/E2E somente após concluir os lotes de implementação.
- [ ] Atualizar status de cada item com evidência real.
- [ ] Só então considerar migration candidata à homologação; aplicação remota e deploy dependem de autorização explícita.

## Situação final desta etapa

**Implementado em código, não validado.** O percentual de progresso do Lote 17 é estimado em 70% porque a escrita da migration e a análise dos principais componentes estão concluídas, mas o inventário integral, a confirmação de privilégios, a validação integrada e o tratamento de dados legados ainda faltam.
