begin;

-- Trigger functions should execute only through their table triggers, not as
-- exposed PostgREST RPC endpoints. Existing triggers remain installed.
revoke all on function public.enforce_vacancy_headcount_and_admission()
  from public, anon, authenticated;
revoke all on function public.sync_vacancy_hired_count()
  from public, anon, authenticated;
revoke all on function public.protect_vacancy_hired_count()
  from public, anon, authenticated;
revoke all on function public.guard_candidatura_transition_write()
  from public, anon, authenticated;

commit;
