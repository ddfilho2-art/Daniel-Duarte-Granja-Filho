drop policy if exists "Admins veem todos os perfis" on public.profiles;
drop policy if exists "Usuários veem o próprio perfil" on public.profiles;
create policy "Perfis visíveis ao usuário ou admin" on public.profiles for select to authenticated using ((select auth.uid()) = id or has_role((select auth.uid()), 'admin'::app_role));
drop policy if exists "Admins atualizam qualquer perfil" on public.profiles;
drop policy if exists "Usuários atualizam o próprio perfil" on public.profiles;
create policy "Perfis atualizáveis pelo usuário ou admin" on public.profiles for update to authenticated using ((select auth.uid()) = id or has_role((select auth.uid()), 'admin'::app_role)) with check ((select auth.uid()) = id or has_role((select auth.uid()), 'admin'::app_role));
drop policy if exists "Admins veem todos os papéis" on public.user_roles;
drop policy if exists "Usuários veem os próprios papéis" on public.user_roles;
create policy "Papéis visíveis ao usuário ou admin" on public.user_roles for select to authenticated using ((select auth.uid()) = user_id or has_role((select auth.uid()), 'admin'::app_role));