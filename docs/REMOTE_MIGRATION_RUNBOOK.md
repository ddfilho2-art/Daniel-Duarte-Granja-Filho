# Rollout remoto — fundação multi-tenant

Este roteiro aplica apenas mudanças aditivas ou de endurecimento comprovadas
contra o diagnóstico de 2026-08-08. Execute primeiro em um projeto Supabase de
staging restaurado de backup. Não use `supabase db push` contra produção: o
histórico local e o histórico remoto não estão reconciliados.

## Pré-requisitos

1. Crie um backup do banco e registre os buckets existentes.
2. Confirme que o projeto remoto é o mesmo diagnosticado: `candidaturas.id`,
   `vagas.id` e `users.id` são `text`.
3. Antes de aplicar o endurecimento de e-mail, publique a Edge Function
   `email-verification` e configure seus secrets. A migration remove as RPCs
   antigas que expõem códigos em texto puro.

## Ordem de aplicação em staging

1. `20260720090000_edge_security_foundation.sql`
2. `20260720091000_email_verification_hardening.sql`
3. `20260720100000_multitenant_foundation.sql`
4. `20260720103000_current_tenant_access.sql`
5. `20260808100000_legacy_recruitment_tenant_bridge.sql`
6. `20260808101000_legacy_rpc_hardening.sql`

Execute um arquivo por vez no SQL Editor e pare ao primeiro erro. Registre a
saída de cada etapa. A migration médica `20260808090000_occupational_health_referrals.sql`
fica para depois de criar o primeiro tenant, realizar o backfill e validar RLS.

## Verificações após as etapas 3–6

```sql
select table_name, column_name, data_type, is_nullable
from information_schema.columns
where table_schema = 'public'
  and column_name = 'tenant_id'
order by table_name;

select routine_name, routine_security
from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('rpc_atualizar_candidatura_processo', 'get_infra_usage');
```

## Próxima etapa, ainda não aplicar

O backfill exige uma decisão operacional: qual tenant receberá os dados legados.
Após criar o primeiro tenant e confirmar seu UUID, será preparada uma migration
específica que preenche `tenant_id`, valida as FKs `NOT VALID` e então ativa RLS
sem interromper a aplicação.
