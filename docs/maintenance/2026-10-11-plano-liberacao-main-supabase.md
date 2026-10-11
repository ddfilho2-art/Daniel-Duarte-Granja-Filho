# Plano de liberação — main + Supabase — 2026-10-11

## Estado atual

- PR de consolidação: [#10](https://github.com/ddfilho2-art/Daniel-Duarte-Granja-Filho/pull/10) — **mergeado** por squash em `d50153b097ad6d03258a9573709d78a65654d41f`.
- Branch: `maintenance/lote-1-integridade-clinica-contratacao-20261010`.
- Commit de aplicação mais recente: `845f577f955719ebce73841471d0ddf65fe4ac1d` (`fix(security): restrict trigger functions to trigger execution`). Os commits posteriores na `main` atualizaram documentação de liberação, base de conhecimento, TODO e roadmap, sem alteração do código da aplicação.
- Type-check e build: passaram na CI do PR no commit `20944bdce5e7b50aa3c06671f5595e5e6b1dd9f9`. O commit posterior em `main` adicionou apenas uma migration SQL; não houve alteração de código de interface.
- Replay da cadeia completa de migrations em Supabase local: **passou** na CI do PR, incluindo inicialização local e aplicação de toda a cadeia versionada.
- Supabase de produção `dmzagrakkduddofkqjhg`: histórico consultado contém **138 migrations**. O conjunto clínico/contratação/faturamento foi aplicado e confirmado na listagem remota; o registro mais recente é `20261011162121` (`revoke_trigger_function_execute`). Tabelas, colunas e RPCs esperadas foram conferidas no catálogo.
- Deploy Vercel: não executado; permanece manual.
- Não havia branch de banco disponível no plano atual. Conforme a ordem explícita do responsável, as migrations foram aplicadas diretamente no Supabase produtivo; não foi criado um ambiente separado de homologação.

## Correção descoberta antes da liberação

A tabela real `public.candidaturas` não tem a coluna `motivo_declinio`, mas a migration de desistência já a usava. A migration `20261011140000_rh_candidatura_withdrawal.sql` foi corrigida para executar `ADD COLUMN IF NOT EXISTS motivo_declinio text` antes de criar a RPC. O workflow E2E também deixou de fixar o checkout em `main` e passou a testar o commit acionado.

## Cadeia aplicada no Supabase

A lista abaixo registra as 27 migrations do lote aplicado em ordem crescente. Todas aparecem no histórico remoto como aplicadas; não as reaplicar. O commit mais recente em `main` adicionou ainda `20261011180000_revoke_trigger_function_execute.sql`, também registrado no Supabase como `revoke_trigger_function_execute`.

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
28. `20261011180000_revoke_trigger_function_execute.sql`

## Snapshot de dados consultado antes da mudança

Na consulta imediatamente antes da aplicação, `vagas`, `candidaturas`, `medical_referrals` e `occupational_health_contracts` estavam vazias; não havia eventos de desistência de RH. Isso reduz o risco de incompatibilidade com dados legados, mas é apenas um retrato daquele momento. Na verificação posterior, os objetos esperados estavam presentes e as tabelas clínicas/de faturamento consultadas não concediam privilégios diretos a `PUBLIC`, `anon` ou `authenticated`.

## Critérios para autorizar o deploy

- [x] CI de type-check/build passou no SHA do PR `20944bdce5e7b50aa3c06671f5595e5e6b1dd9f9`.
- [x] CI local inicializou Supabase e aplicou a cadeia completa sem erro.
- [x] PR #10 foi mergeado e o SHA de `main` verificado (`845f577f955719ebce73841471d0ddf65fe4ac1d`).
- [x] As 28 migrations do lote foram confirmadas no histórico remoto, incluindo a migration adicional de hardening de funções de trigger.
- [x] Verificação pós-migration confirmou as principais tabelas/colunas/RPCs e que as novas tabelas clínicas/de faturamento não concedem acesso direto às roles de cliente.
- [!] O linter de segurança ainda reporta findings informativos de RLS sem policy (14 tabelas, com grants de cliente revogados nas tabelas novas) e warnings para funções SECURITY DEFINER. Esses avisos precisam de triagem contínua; não significam que todos os findings foram eliminados.
- [x] Build e type-check passaram na CI do PR; desde então, `main` recebeu apenas uma migration SQL de revogação de EXECUTE em funções de trigger. Não foi observado um run de build separado no SHA `845f577f`.
- [x] Histórico remoto mostra todas as migrations do lote aplicadas; os objetos principais foram localizados no catálogo.

## Smoke tests após o deploy manual da Vercel

1. Login/logout e atualização da sessão nos perfis de candidato, RH, administrador de empresa, secretaria clínica, médico e administrador da clínica.
2. Cadastro e confirmação por e-mail; código de seis dígitos e reenvio; criação/edição de usuário RH.
3. Inscrição em vaga, visualização de candidatura, ações individuais e em massa, reserva, desistência, reprovação e contratação com exame admissional apto.
4. Clínica: fila disponível, atribuição atômica a um médico, visão limitada do médico versus secretaria/admin, agendamento com data/local, resultado, conclusão e exame complementar.
5. Faturamento: cadastro de serviço/preço, registro e correção controlada de atendimento/faturamento, relatórios e filtros.
6. Persistência de logo da empresa e isolamento entre duas empresas; conferir console e logs de rede por 401/403/400/500.

**Estado atual:** as mudanças estão em `main` e as migrations já estão aplicadas no Supabase. **O próximo passo é o deploy manual da Vercel pelo responsável.** A validação funcional continua pendente e deverá ocorrer imediatamente após o deploy; type-check/build e replay local não substituem os smoke tests.
