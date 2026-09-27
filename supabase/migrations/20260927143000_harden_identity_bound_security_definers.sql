create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select auth.uid() is not null
    and _user_id = auth.uid()
    and exists (
      select 1
      from public.user_roles
      where user_id = auth.uid()
        and role::text = _role::text
    );
$function$;

create or replace function public.is_member_of(_user_id uuid, _grupo_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select auth.uid() is not null
    and _user_id = auth.uid()
    and exists (
      select 1
      from public.grupo_membros
      where user_id = auth.uid()
        and grupo_id = _grupo_id
    );
$function$;

create or replace function public.is_member_of_text(_user_id uuid, _grupo_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $function$
  select auth.uid() is not null
    and _user_id = auth.uid()
    and exists (
      select 1
      from public.grupo_membros
      where user_id = auth.uid()
        and grupo_id::text = _grupo_id
    );
$function$;