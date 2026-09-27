do $$
declare
  r record;
  u text;
  c text;
  cmd text;
begin
  for r in
    select
      n.nspname as schema_name,
      c.relname as table_name,
      p.polname,
      pg_get_expr(p.polqual, p.polrelid) as using_expr,
      pg_get_expr(p.polwithcheck, p.polrelid) as check_expr
    from pg_policy p
    join pg_class c on c.oid = p.polrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and (
        coalesce(pg_get_expr(p.polqual, p.polrelid), '') like '%auth.uid()%'
        or coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') like '%auth.uid()%'
      )
  loop
    -- Preserve existing scalar-subquery forms while wrapping only direct auth.uid() calls.
    u := r.using_expr;
    c := r.check_expr;

    if u is not null then
      u := regexp_replace(u, '(?i)select[[:space:]]+auth\.uid\(\)', '__KEEP_AUTH_UID__', 'g');
      u := replace(u, 'auth.uid()', '(select auth.uid())');
      u := replace(u, '__KEEP_AUTH_UID__', 'SELECT auth.uid()');
    end if;

    if c is not null then
      c := regexp_replace(c, '(?i)select[[:space:]]+auth\.uid\(\)', '__KEEP_AUTH_UID__', 'g');
      c := replace(c, 'auth.uid()', '(select auth.uid())');
      c := replace(c, '__KEEP_AUTH_UID__', 'SELECT auth.uid()');
    end if;

    if u is distinct from r.using_expr then
      cmd := format('alter policy %I on %I.%I using (%s)', r.polname, r.schema_name, r.table_name, u);
      execute cmd;
    end if;

    if c is distinct from r.check_expr then
      cmd := format('alter policy %I on %I.%I with check (%s)', r.polname, r.schema_name, r.table_name, c);
      execute cmd;
    end if;
  end loop;
end $$;
