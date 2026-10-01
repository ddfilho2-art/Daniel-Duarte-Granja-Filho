-- Harden Auth -> public.users bootstrap.
-- Never trust raw_user_meta_data.profile for authorization.
-- Privileged profiles are assigned only by trusted server-side administration.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
begin
  if not exists (select 1 from public.users where id = new.id::text) then
    insert into public.users (
      id, uid, email, nome, login, login_lower, perfil, status, resume_completed
    )
    values (
      new.id::text,
      new.id::text,
      new.email,
      new.raw_user_meta_data->>'nome',
      new.raw_user_meta_data->>'login',
      lower(new.raw_user_meta_data->>'login'),
      'Candidato',
      'Ativo',
      false
    );
  end if;
  return new;
end;
$function$;

revoke all on function public.handle_new_user() from public, anon, authenticated;
