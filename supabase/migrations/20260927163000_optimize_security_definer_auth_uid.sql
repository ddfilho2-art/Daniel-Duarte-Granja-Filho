do $$
declare
  r record;
  v_def text;
begin
  for r in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.prosecdef
      and pg_get_functiondef(p.oid) like '%auth.uid()%'
  loop
    v_def := pg_get_functiondef(r.oid);
    v_def := replace(v_def, 'auth.uid()', '(select auth.uid())');
    execute v_def;
  end loop;
end $$;
