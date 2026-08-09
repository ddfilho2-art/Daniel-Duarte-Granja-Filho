-- Diagnóstico somente leitura: definições de RPCs/procedures do schema public.
-- IMPORTANTE: revise a coluna definition e remova tokens, senhas, URLs privadas ou
-- outros literais secretos antes de compartilhar o resultado.

select
  p.oid::regprocedure::text as signature,
  pg_get_userbyid(p.proowner) as owner,
  p.prosecdef as security_definer,
  p.provolatile as volatility,
  p.proparallel as parallel_safety,
  p.proconfig as runtime_config,
  obj_description(p.oid, 'pg_proc') as comment,
  pg_get_functiondef(p.oid) as definition
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.prokind in ('f', 'p')
  and not exists (
    select 1
    from pg_depend d
    where d.classid = 'pg_proc'::regclass
      and d.objid = p.oid
      and d.deptype = 'e'
  )
order by signature;
