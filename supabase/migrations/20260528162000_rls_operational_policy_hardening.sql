-- Hardening incremental de RLS operacional.
-- Mantém migrations antigas intactas e substitui políticas amplas por versões com
-- WITH CHECK explícito e leitura de membros de grupos limitada ao contexto necessário.

-- Helper tolerante para checar vínculo de grupo armazenado em JSON/texto sem cast inseguro.
create or replace function public.is_member_of_text(_user_id uuid, _grupo_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.grupo_membros
    where user_id = _user_id
      and grupo_id::text = _grupo_id
  );
$$;

-- Profiles: usuários não podem trocar o próprio id em updates; admins continuam podendo gerenciar.
drop policy if exists "Usuários atualizam o próprio perfil" on public.profiles;
create policy "Usuários atualizam o próprio perfil"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Admins atualizam qualquer perfil" on public.profiles;
create policy "Admins atualizam qualquer perfil"
  on public.profiles for update to authenticated
  using (public.has_role(auth.uid(), 'admin'::public.app_role))
  with check (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Notificações: impede update que transfira uma notificação para outro usuário.
drop policy if exists "Usuário atualiza suas notificações" on public.notificacoes;
create policy "Usuário atualiza suas notificações"
  on public.notificacoes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Storage/avatar: impede update movendo objeto para outro bucket/pasta.
drop policy if exists "Usuário atualiza seu avatar" on storage.objects;
create policy "Usuário atualiza seu avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'avatars' and auth.uid()::text = (storage.foldername(name))[1]);

-- Tarefas: mantém compatibilidade com responsável, solicitante, admin e dono_processo,
-- mas adiciona WITH CHECK e suporte explícito a tarefas de grupo via dados_formulario.
drop policy if exists "Responsável e admins veem tarefas" on public.tarefas;
create policy "Responsável e admins veem tarefas"
  on public.tarefas for select to authenticated
  using (
    responsavel_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'dono_processo'::public.app_role)
    or exists (
      select 1
      from public.processo_instancias i
      where i.id = tarefas.instancia_id
        and i.solicitante_id = auth.uid()
    )
    or (
      dados_formulario ? '__grupo_responsavel_id'
      and public.is_member_of_text(
        auth.uid(),
        dados_formulario ->> '__grupo_responsavel_id'
      )
    )
  );

drop policy if exists "Responsável e admins atualizam tarefas" on public.tarefas;
create policy "Responsável e admins atualizam tarefas"
  on public.tarefas for update to authenticated
  using (
    responsavel_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'dono_processo'::public.app_role)
    or (
      responsavel_id is null
      and dados_formulario ? '__grupo_responsavel_id'
      and public.is_member_of_text(
        auth.uid(),
        dados_formulario ->> '__grupo_responsavel_id'
      )
    )
  )
  with check (
    responsavel_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'dono_processo'::public.app_role)
    or (
      responsavel_id is null
      and dados_formulario ? '__grupo_responsavel_id'
      and public.is_member_of_text(
        auth.uid(),
        dados_formulario ->> '__grupo_responsavel_id'
      )
    )
  );

-- Eventos: inclui participantes de tarefas de grupo e qualifica referências.
drop policy if exists "Participantes veem eventos" on public.instancia_eventos;
create policy "Participantes veem eventos"
  on public.instancia_eventos for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'dono_processo'::public.app_role)
    or exists (
      select 1
      from public.processo_instancias i
      where i.id = instancia_eventos.instancia_id
        and i.solicitante_id = auth.uid()
    )
    or exists (
      select 1
      from public.tarefas t
      where t.instancia_id = instancia_eventos.instancia_id
        and (
          t.responsavel_id = auth.uid()
          or (
            t.dados_formulario ? '__grupo_responsavel_id'
            and public.is_member_of_text(
              auth.uid(),
              t.dados_formulario ->> '__grupo_responsavel_id'
            )
          )
        )
    )
  );

drop policy if exists "Participantes registram eventos" on public.instancia_eventos;
create policy "Participantes registram eventos"
  on public.instancia_eventos for insert to authenticated
  with check (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'dono_processo'::public.app_role)
    or exists (
      select 1
      from public.processo_instancias i
      where i.id = instancia_eventos.instancia_id
        and i.solicitante_id = auth.uid()
    )
    or exists (
      select 1
      from public.tarefas t
      where t.instancia_id = instancia_eventos.instancia_id
        and (
          t.responsavel_id = auth.uid()
          or (
            t.dados_formulario ? '__grupo_responsavel_id'
            and public.is_member_of_text(
              auth.uid(),
              t.dados_formulario ->> '__grupo_responsavel_id'
            )
          )
        )
    )
  );

-- Log de integrações: leitura também é permitida ao solicitante/responsável relacionado,
-- não apenas a perfis elevados. A escrita segue restrita ao contexto operacional.
drop policy if exists "Admins e donos veem log_sync" on public.log_sync;
create policy "Participantes veem log_sync"
  on public.log_sync for select to authenticated
  using (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    or public.has_role(auth.uid(), 'dono_processo'::public.app_role)
    or (
      instancia_id is not null
      and exists (
        select 1
        from public.processo_instancias i
        where i.id = log_sync.instancia_id
          and i.solicitante_id = auth.uid()
      )
    )
    or (
      tarefa_id is not null
      and exists (
        select 1
        from public.tarefas t
        where t.id = log_sync.tarefa_id
          and (
            t.responsavel_id = auth.uid()
            or (
              t.dados_formulario ? '__grupo_responsavel_id'
              and public.is_member_of_text(
                auth.uid(),
                t.dados_formulario ->> '__grupo_responsavel_id'
              )
            )
          )
      )
    )
  );

-- Membros de grupos: remove leitura geral. Usuários veem apenas seus vínculos; admins veem tudo.
-- O acesso operacional por grupo continua via public.is_member_of SECURITY DEFINER.
drop policy if exists "Autenticados leem membros" on public.grupo_membros;
create policy "Usuários veem próprios vínculos de grupo"
  on public.grupo_membros for select to authenticated
  using (
    user_id = auth.uid()
    or public.has_role(auth.uid(), 'admin'::public.app_role)
  );
