-- Additive bridge from the discovered legacy recruitment schema to tenancy.
-- Apply only after 20260720100000_multitenant_foundation.sql.  All columns are
-- nullable on purpose: no production row is reassigned by this migration.

do $$
begin
  if to_regclass('public.tenants') is null then
    raise exception 'multitenant_foundation_must_be_applied_first';
  end if;
end;
$$;

do $$
declare
  v_table text;
begin
  foreach v_table in array array[
    'vagas',
    'candidaturas',
    'candidatura_eventos',
    'candidatura_historico',
    'mensagens',
    'analise_ia_candidato',
    'provas',
    'provas_versoes',
    'settings',
    'transferencias',
    'unidades_negocio',
    'email_queue',
    'logs'
  ] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('alter table public.%I add column if not exists tenant_id uuid', v_table);
      execute format(
        'create index if not exists %I on public.%I (tenant_id)',
        'idx_' || v_table || '_tenant_id', v_table
      );
    end if;
  end loop;
end;
$$;

do $$
declare
  v_table text;
  v_constraint text;
begin
  foreach v_table in array array[
    'vagas', 'candidaturas', 'candidatura_eventos', 'candidatura_historico',
    'mensagens', 'analise_ia_candidato', 'provas', 'provas_versoes', 'settings',
    'transferencias', 'unidades_negocio', 'email_queue', 'logs'
  ] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      v_constraint := 'fk_' || v_table || '_tenant';
      if not exists (
        select 1 from pg_constraint
        where conrelid = format('public.%I', v_table)::regclass
          and conname = v_constraint
      ) then
        execute format(
          'alter table public.%I add constraint %I foreign key (tenant_id) references public.tenants(id) not valid',
          v_table, v_constraint
        );
      end if;
    end if;
  end loop;
end;
$$;

-- A single legacy candidate/application may be global while ARC-006 is pending;
-- membership is the tenant linkage for authenticated users.  Do not add a
-- tenant_id to `users` or `profiles` until the CV retention decision is made.

do $recruta$
begin
  if to_regclass('public.vagas') is not null then
    comment on column public.vagas.tenant_id is 'Nullable during migration; populated by the controlled backfill before RLS is enabled.';
  end if;
  if to_regclass('public.candidaturas') is not null then
    comment on column public.candidaturas.tenant_id is 'Must match the tenant of its vacancy after the backfill.';
  end if;
  if to_regclass('public.mensagens') is not null then
    comment on column public.mensagens.tenant_id is 'Must match the tenant of its candidatura/vaga after the backfill.';
  end if;
  if to_regclass('public.analise_ia_candidato') is not null then
    comment on column public.analise_ia_candidato.tenant_id is 'Derived from the job tenant; AI result must not cross tenants.';
  end if;
end
$recruta$;
