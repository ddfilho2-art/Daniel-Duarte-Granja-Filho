-- RLS tenant-aware policies for legacy recruitment tables.
-- IMPORTANT: Apply AFTER tenant_id backfill is complete (20260811110000).
-- Until backfill finishes, these policies would block all access for rows
-- with NULL tenant_id.  Enable in staging first, validate with two tenants,
-- then promote to production.

-- ===========================================================================
-- GUARD: refuse to apply if tenant_id columns are missing (bridge not applied)
-- ===========================================================================
do $$
begin
  if to_regclass('public.vagas') is not null
    and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'vagas' and column_name = 'tenant_id'
    ) then
    raise exception 'legacy_bridge_must_be_applied_first';
  end if;
end;
$$;

-- ===========================================================================
-- VAGAS — public read via view; authenticated read/write scoped to tenant
-- ===========================================================================
do $$ begin
  if to_regclass('public.vagas') is not null then
    alter table public.vagas enable row level security;

    drop policy if exists vagas_select_policy on public.vagas;
    execute 'create policy vagas_select_policy on public.vagas for select to authenticated using (
      public.is_platform_master_admin()
      or tenant_id = public.current_tenant_id()
    )';

    drop policy if exists vagas_insert_policy on public.vagas;
    execute 'create policy vagas_insert_policy on public.vagas for insert to authenticated with check (
      tenant_id = public.current_tenant_id()
      and public.has_tenant_role(tenant_id,
        array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
    )';

    drop policy if exists vagas_update_policy on public.vagas;
    execute 'create policy vagas_update_policy on public.vagas for update to authenticated using (
      tenant_id = public.current_tenant_id()
      and public.has_tenant_role(tenant_id,
        array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
    ) with check (
      tenant_id = public.current_tenant_id()
      and public.has_tenant_role(tenant_id,
        array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
    )';

    drop policy if exists vagas_delete_policy on public.vagas;
    execute 'create policy vagas_delete_policy on public.vagas for delete to authenticated using (
      tenant_id = public.current_tenant_id()
      and public.can_administer_tenant(tenant_id)
    )';
  end if;
end $$;

-- ===========================================================================
-- CANDIDATURAS
-- ===========================================================================
do $$ begin
  if to_regclass('public.candidaturas') is not null then
    alter table public.candidaturas enable row level security;

    drop policy if exists candidaturas_select_policy on public.candidaturas;
    execute 'create policy candidaturas_select_policy on public.candidaturas for select to authenticated using (
      public.is_platform_master_admin()
      or tenant_id = public.current_tenant_id()
      or candidato_id = auth.uid()::text
    )';

    drop policy if exists candidaturas_insert_policy on public.candidaturas;
    execute 'create policy candidaturas_insert_policy on public.candidaturas for insert to authenticated with check (
      tenant_id = public.current_tenant_id()
    )';

    drop policy if exists candidaturas_update_policy on public.candidaturas;
    execute 'create policy candidaturas_update_policy on public.candidaturas for update to authenticated using (
      tenant_id = public.current_tenant_id()
      and (
        public.has_tenant_role(tenant_id,
          array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
        or candidato_id = auth.uid()::text
      )
    ) with check (tenant_id = public.current_tenant_id())';

    drop policy if exists candidaturas_delete_policy on public.candidaturas;
    execute 'create policy candidaturas_delete_policy on public.candidaturas for delete to authenticated using (
      tenant_id = public.current_tenant_id()
      and public.can_administer_tenant(tenant_id)
    )';
  end if;
end $$;

-- ===========================================================================
-- CANDIDATURA_EVENTOS and CANDIDATURA_HISTORICO
-- ===========================================================================
do $$
declare
  v_table text;
begin
  foreach v_table in array array['candidatura_eventos', 'candidatura_historico'] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('alter table public.%I enable row level security', v_table);

      execute format('drop policy if exists %s_select_policy on public.%I', v_table, v_table);
      execute format(
        'create policy %s_select_policy on public.%I for select to authenticated using (
          public.is_platform_master_admin() or tenant_id = public.current_tenant_id()
        )', v_table, v_table);

      execute format('drop policy if exists %s_insert_policy on public.%I', v_table, v_table);
      execute format(
        'create policy %s_insert_policy on public.%I for insert to authenticated with check (
          tenant_id = public.current_tenant_id()
          and public.has_tenant_role(tenant_id,
            array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
        )', v_table, v_table);
    end if;
  end loop;
end $$;

-- ===========================================================================
-- MENSAGENS
-- ===========================================================================
do $$ begin
  if to_regclass('public.mensagens') is not null then
    alter table public.mensagens enable row level security;

    drop policy if exists mensagens_select_policy on public.mensagens;
    execute 'create policy mensagens_select_policy on public.mensagens for select to authenticated using (
      public.is_platform_master_admin()
      or tenant_id = public.current_tenant_id()
    )';

    drop policy if exists mensagens_insert_policy on public.mensagens;
    execute 'create policy mensagens_insert_policy on public.mensagens for insert to authenticated with check (
      tenant_id = public.current_tenant_id()
      and public.is_tenant_member(tenant_id)
    )';

    drop policy if exists mensagens_update_policy on public.mensagens;
    execute 'create policy mensagens_update_policy on public.mensagens for update to authenticated using (
      tenant_id = public.current_tenant_id()
      and remetente_id = auth.uid()::text
    ) with check (tenant_id = public.current_tenant_id())';
  end if;
end $$;

-- ===========================================================================
-- ANALISE_IA_CANDIDATO
-- ===========================================================================
do $$ begin
  if to_regclass('public.analise_ia_candidato') is not null then
    alter table public.analise_ia_candidato enable row level security;

    drop policy if exists analise_ia_select_policy on public.analise_ia_candidato;
    execute 'create policy analise_ia_select_policy on public.analise_ia_candidato for select to authenticated using (
      public.is_platform_master_admin()
      or (
        tenant_id = public.current_tenant_id()
        and public.has_tenant_role(tenant_id,
          array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
      )
    )';

    drop policy if exists analise_ia_insert_policy on public.analise_ia_candidato;
    execute 'create policy analise_ia_insert_policy on public.analise_ia_candidato for insert to authenticated with check (
      tenant_id = public.current_tenant_id()
    )';
  end if;
end $$;

-- ===========================================================================
-- PROVAS and PROVAS_VERSOES
-- ===========================================================================
do $$
declare
  v_table text;
begin
  foreach v_table in array array['provas', 'provas_versoes'] loop
    if to_regclass(format('public.%I', v_table)) is not null then
      execute format('alter table public.%I enable row level security', v_table);

      execute format('drop policy if exists %s_select_policy on public.%I', v_table, v_table);
      execute format(
        'create policy %s_select_policy on public.%I for select to authenticated using (
          public.is_platform_master_admin()
          or tenant_id = public.current_tenant_id()
        )', v_table, v_table);

      execute format('drop policy if exists %s_insert_policy on public.%I', v_table, v_table);
      execute format(
        'create policy %s_insert_policy on public.%I for insert to authenticated with check (
          tenant_id = public.current_tenant_id()
          and public.has_tenant_role(tenant_id,
            array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
        )', v_table, v_table);

      execute format('drop policy if exists %s_update_policy on public.%I', v_table, v_table);
      execute format(
        'create policy %s_update_policy on public.%I for update to authenticated using (
          tenant_id = public.current_tenant_id()
          and public.has_tenant_role(tenant_id,
            array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
        ) with check (tenant_id = public.current_tenant_id())', v_table, v_table);

      execute format('drop policy if exists %s_delete_policy on public.%I', v_table, v_table);
      execute format(
        'create policy %s_delete_policy on public.%I for delete to authenticated using (
          tenant_id = public.current_tenant_id()
          and public.can_administer_tenant(tenant_id)
        )', v_table, v_table);
    end if;
  end loop;
end $$;

-- ===========================================================================
-- SETTINGS — tenant-scoped configuration
-- ===========================================================================
do $$ begin
  if to_regclass('public.settings') is not null then
    alter table public.settings enable row level security;

    drop policy if exists settings_select_policy on public.settings;
    execute 'create policy settings_select_policy on public.settings for select to authenticated using (
      public.is_platform_master_admin()
      or (
        tenant_id = public.current_tenant_id()
        and public.can_administer_tenant(tenant_id)
      )
    )';

    drop policy if exists settings_update_policy on public.settings;
    execute 'create policy settings_update_policy on public.settings for update to authenticated using (
      tenant_id = public.current_tenant_id()
      and public.can_administer_tenant(tenant_id)
    ) with check (tenant_id = public.current_tenant_id())';

    drop policy if exists settings_insert_policy on public.settings;
    execute 'create policy settings_insert_policy on public.settings for insert to authenticated with check (
      tenant_id = public.current_tenant_id()
      and public.can_administer_tenant(tenant_id)
    )';
  end if;
end $$;

-- ===========================================================================
-- TRANSFERENCIAS
-- ===========================================================================
do $$ begin
  if to_regclass('public.transferencias') is not null then
    alter table public.transferencias enable row level security;

    drop policy if exists transferencias_select_policy on public.transferencias;
    execute 'create policy transferencias_select_policy on public.transferencias for select to authenticated using (
      public.is_platform_master_admin()
      or tenant_id = public.current_tenant_id()
    )';

    drop policy if exists transferencias_insert_policy on public.transferencias;
    execute 'create policy transferencias_insert_policy on public.transferencias for insert to authenticated with check (
      tenant_id = public.current_tenant_id()
      and public.has_tenant_role(tenant_id,
        array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
    )';

    drop policy if exists transferencias_update_policy on public.transferencias;
    execute 'create policy transferencias_update_policy on public.transferencias for update to authenticated using (
      tenant_id = public.current_tenant_id()
      and public.has_tenant_role(tenant_id,
        array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role])
    ) with check (tenant_id = public.current_tenant_id())';
  end if;
end $$;

-- ===========================================================================
-- UNIDADES_NEGOCIO
-- ===========================================================================
do $$ begin
  if to_regclass('public.unidades_negocio') is not null then
    alter table public.unidades_negocio enable row level security;

    drop policy if exists unidades_negocio_select_policy on public.unidades_negocio;
    execute 'create policy unidades_negocio_select_policy on public.unidades_negocio for select to authenticated using (
      public.is_platform_master_admin()
      or tenant_id = public.current_tenant_id()
    )';

    drop policy if exists unidades_negocio_insert_policy on public.unidades_negocio;
    execute 'create policy unidades_negocio_insert_policy on public.unidades_negocio for insert to authenticated with check (
      tenant_id = public.current_tenant_id()
      and public.can_administer_tenant(tenant_id)
    )';

    drop policy if exists unidades_negocio_update_policy on public.unidades_negocio;
    execute 'create policy unidades_negocio_update_policy on public.unidades_negocio for update to authenticated using (
      tenant_id = public.current_tenant_id()
      and public.can_administer_tenant(tenant_id)
    ) with check (tenant_id = public.current_tenant_id())';
  end if;
end $$;

-- ===========================================================================
-- EMAIL_QUEUE
-- ===========================================================================
do $$ begin
  if to_regclass('public.email_queue') is not null then
    alter table public.email_queue enable row level security;

    drop policy if exists email_queue_select_policy on public.email_queue;
    execute 'create policy email_queue_select_policy on public.email_queue for select to authenticated using (
      public.is_platform_master_admin()
      or (
        tenant_id = public.current_tenant_id()
        and public.can_administer_tenant(tenant_id)
      )
    )';

    drop policy if exists email_queue_insert_policy on public.email_queue;
    execute 'create policy email_queue_insert_policy on public.email_queue for insert to authenticated with check (
      tenant_id = public.current_tenant_id()
    )';
  end if;
end $$;

-- ===========================================================================
-- LOGS — append-only; tenant admins and platform read
-- ===========================================================================
do $$ begin
  if to_regclass('public.logs') is not null then
    alter table public.logs enable row level security;

    drop policy if exists logs_select_policy on public.logs;
    execute 'create policy logs_select_policy on public.logs for select to authenticated using (
      public.is_platform_master_admin()
      or (
        tenant_id = public.current_tenant_id()
        and public.can_administer_tenant(tenant_id)
      )
    )';

    drop policy if exists logs_insert_policy on public.logs;
    execute 'create policy logs_insert_policy on public.logs for insert to authenticated with check (
      tenant_id = public.current_tenant_id()
    )';
  end if;
end $$;

-- ===========================================================================
-- USERS — users see themselves; Admin/RH see tenant members; Master sees all
-- ===========================================================================
do $$ begin
  if to_regclass('public.users') is not null then
    alter table public.users enable row level security;

    drop policy if exists users_select_policy on public.users;
    execute 'create policy users_select_policy on public.users for select to authenticated using (
      public.is_platform_master_admin()
      or id = auth.uid()::text
      or uid = auth.uid()::text
      or exists (
        select 1 from public.tenant_memberships tm
        where tm.user_id = auth.uid()
          and tm.status = ''active''
          and tm.roles && array[''tenant_admin''::public.tenant_role, ''tenant_admin_substitute''::public.tenant_role, ''hr''::public.tenant_role]
          and tm.tenant_id = public.current_tenant_id()
      )
    )';

    drop policy if exists users_update_policy on public.users;
    execute 'create policy users_update_policy on public.users for update to authenticated using (
      id = auth.uid()::text or uid = auth.uid()::text
    ) with check (id = auth.uid()::text or uid = auth.uid()::text)';
  end if;
end $$;

-- ===========================================================================
-- PUBLIC VIEW: vagas without PII for unauthenticated visitors
-- ===========================================================================
do $$ begin
  if to_regclass('public.vagas') is not null then
    drop view if exists public.public_vagas_view;

    -- Only expose safe columns; the view is accessible to anon.
    execute 'create or replace view public.public_vagas_view as
      select
        v.id,
        v.tenant_id,
        v.titulo,
        v.descricao,
        v.departamento,
        v.local as localizacao,
        v.tipo_contrato,
        v.status,
        v.created_at,
        v.atualizado_em as updated_at
      from public.vagas v
      where v.status in (''Aberta'', ''aberta'', ''active'', ''ativo'')
        and v.tenant_id is not null';

    grant select on public.public_vagas_view to anon, authenticated;
  end if;
end $$;

-- ===========================================================================
-- STORAGE POLICIES: tenant-scoped access for recruitment buckets
-- ===========================================================================

-- Resumes bucket — candidate writes own file, HR reads within tenant
drop policy if exists resumes_tenant_read on storage.objects;
create policy resumes_tenant_read on storage.objects for select to authenticated
using (
  bucket_id = 'resumes'
  and (
    public.is_platform_master_admin()
    or (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

drop policy if exists resumes_owner_write on storage.objects;
create policy resumes_owner_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'resumes'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

-- Provas bucket — tenant-scoped
drop policy if exists provas_tenant_read on storage.objects;
create policy provas_tenant_read on storage.objects for select to authenticated
using (
  bucket_id = 'provas'
  and (
    public.is_platform_master_admin()
    or (storage.foldername(name))[1] = public.current_tenant_id()::text
  )
);

drop policy if exists provas_tenant_write on storage.objects;
create policy provas_tenant_write on storage.objects for insert to authenticated
with check (
  bucket_id = 'provas'
  and (storage.foldername(name))[1] = public.current_tenant_id()::text
);

-- Medical referral attachments — participants only (private bucket)
drop policy if exists medical_attachments_read on storage.objects;
create policy medical_attachments_read on storage.objects for select to authenticated
using (
  bucket_id = 'medical-referral-attachments'
  and public.can_access_medical_referral(
    ((storage.foldername(name))[1])::uuid
  )
);

drop policy if exists medical_attachments_insert on storage.objects;
create policy medical_attachments_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'medical-referral-attachments'
  and public.can_access_medical_referral(
    ((storage.foldername(name))[1])::uuid
  )
);

comment on policy medical_attachments_read on storage.objects is
  'Only referral participants can download attachments';
comment on policy medical_attachments_insert on storage.objects is
  'Only referral participants can upload attachments';
