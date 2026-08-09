-- Foundation function for updated_at triggers used across all tables
-- This must be applied BEFORE multitenant_foundation

create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public;
grant execute on function public.set_updated_at()
  to postgres, service_role;

comment on function public.set_updated_at() is
  'Trigger function to automatically update the updated_at timestamp on table modifications.';
