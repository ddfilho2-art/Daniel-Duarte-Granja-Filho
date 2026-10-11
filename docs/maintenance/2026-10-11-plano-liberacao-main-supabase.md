# Plano de liberação — main + Supabase — 2026-10-11

## Estado atual

- PR de consolidação: #10 — aberto; não mergeado.
- Branch: `maintenance/lote-1-integridade-clinica-contratacao-20261010`.
- Commit da validação mais recente: `b189b68784dab2782082a9b839625523dffb9588`.
- Type-check e build: passaram nesse commit.
- Replay das migrations em Supabase local: em execução na CI; merge depende do resultado.
- Supabase de produção `dmzagrakkduddofkqjhg`: última migration registrada `20261009220539` (`tenant_admin_password_reset_audit`); as migrations abaixo ainda não constam como aplicadas.
- Deploy Vercel: não executado; permanece manual.
- A tentativa de criar branch de homologação do Supabase foi recusada porque database branching exige plano Pro ou superior. Nenhuma migration foi aplicada no banco remoto por esta manutenção.

## Correção descoberta antes da liberação

A tabela real `public.candidaturas` não tem a coluna `motivo_declinio`, mas a migration de desistência já a usava. A migration `20261011140000_rh_candidatura_withdrawal.sql` foi corrigida para executar `ADD COLUMN IF NOT EXISTS motivo_declinio text` antes de criar a RPC. O workflow E2E também deixou de fixar o checkout em `main` e passou a testar o commit acionado.

## Cadeia pendente no Supabase

Aplicar somente após o replay completo passar na CI; manter a ordem crescente dos prefixos. Não pular migrations da área clínica/faturamento para aplicar apenas os últimos lotes.

1. `20261010120000_employer_clinic_conversations.sql`
2. `20261010121500_tenant_clinic_attachment_listing.sql`
3. `20261010123000_tenant_clinic_conversation_labels.sql`
4. `20261010130000_list_employer_clinic_contracts.sql`
5. `20261010140000_tenant_clinic_appointments.sql`
6. `20261010143000_move_tenant_clinic_appointments.sql`
7. `20261010150000_clinic_admin_tenant_list.sql`
8. `20261010160000_clinic_calendar_integration_settings.sql`
9. `20261010163000_get_clinic_calendar_timezone.sql`
10. `20261010170000_guard_calendar_change_with_active_appointments.sql`
11. `20261010171000_hide_attachments_for_inaccessible_referrals.sql`
12. `20261010190000_lote1_integridade_clinica_contratacao.sql`
13. `20261010200000_add_clinic_doctor_role.sql`
14. `20261010201000_clinic_queue_assignment_fifo.sql`
15. `20261010210000_complementary_exam_catalog_and_workflow.sql`
16. `20261010220000_occupational_health_billing_foundation.sql`
17. `20261010230000_occupational_health_billing_read_rpcs.sql`
18. `20261011080000_occupational_health_service_catalog_admin.sql`
19. `20261011090000_occupational_health_billing_history_integrity.sql`
20. `20261011100000_clinic_operational_tenant_list.sql`
21. `20261011110000_clinic_priority_queue_admin_rpc.sql`
22. `20261011120000_billing_macro_report_v2.sql`
23. `20261011130000_clinic_queue_scoped_rpc.sql`
24. `20261011140000_rh_candidatura_withdrawal.sql`
25. `20261011150000_harden_candidatura_process_transition.sql`
26. `20261011160000_harden_medical_referral_writes_and_transitions.sql`
27. `20261011170000_harden_candidatura_client_write_surface.sql`

## Snapshot de dados consultado antes da mudança

Na consulta de 2026-10-11, as tabelas `vagas`, `candidaturas` e `medical_referrals` retornaram zero registros, assim como os eventos de auditoria para desistência de RH. Repetir a checagem imediatamente antes das migrations, pois este dado pode mudar.

## Critérios para autorizar o deploy

- [ ] CI de type-check/build passou no SHA do PR.
- [ ] CI local inicializou Supabase e aplicou a cadeia completa sem erro.
- [ ] PR #10 foi mergeado e o SHA de `main` verificado.
- [ ] As 27 migrations foram aplicadas no Supabase em ordem e a listagem remota foi conferida.
- [ ] Catálogo pós-migration confirma funções, triggers, constraints, policies e grants esperados; advisors são revistos.
- [ ] Build/CI de `main` passou depois do merge.
- [ ] Não há migration parcial/falha nem diferença inesperada no schema.

## Smoke tests após o deploy manual da Vercel

1. Login/logout e atualização da sessão nos perfis de candidato, RH, administrador de empresa, secretaria clínica, médico e administrador da clínica.
2. Cadastro e confirmação por e-mail; código de seis dígitos e reenvio; criação/edição de usuário RH.
3. Inscrição em vaga, visualização de candidatura, ações individuais e em massa, reserva, desistência, reprovação e contratação com exame admissional apto.
4. Clínica: fila disponível, atribuição atômica a um médico, visão limitada do médico versus secretaria/admin, agendamento com data/local, resultado, conclusão e exame complementar.
5. Faturamento: cadastro de serviço/preço, registro e correção controlada de atendimento/faturamento, relatórios e filtros.
6. Persistência de logo da empresa e isolamento entre duas empresas; conferir console e logs de rede por 401/403/400/500.

**Regra de publicação:** não executar o deploy Vercel antes de a cadeia do Supabase e os critérios acima estarem confirmados. A CI e o replay de migrations não substituem os smoke tests funcionais pós-deploy.
