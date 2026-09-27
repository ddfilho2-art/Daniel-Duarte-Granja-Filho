create or replace function public.normalize_prefixo_instancia(raw_value text)
returns text
language plpgsql
set search_path = public, pg_temp
as $function$
declare normalized text;
begin
  normalized := regexp_replace(upper(coalesce(raw_value, '')), '[^A-Z0-9]+', '', 'g');
  if normalized is null or normalized = '' then normalized := 'PROC'; end if;
  return left(normalized, 10);
end;
$function$;

create or replace function public.generate_codigo_instancia(p_processo_id uuid, p_iniciado_em timestamptz default now())
returns text
language plpgsql
set search_path = public, pg_temp
as $function$
declare
  v_prefixo text;
  v_ano smallint;
  v_numero integer;
begin
  select public.normalize_prefixo_instancia(prefixo_instancia) into v_prefixo
  from public.processos where id = p_processo_id;
  if v_prefixo is null then
    raise exception 'Processo % não encontrado para geração de código da instância', p_processo_id;
  end if;
  v_ano := (extract(year from coalesce(p_iniciado_em, now()))::integer % 100)::smallint;
  insert into public.processo_instancia_counters (processo_id, ano, ultimo_numero)
  values (p_processo_id, v_ano, 1)
  on conflict (processo_id, ano)
  do update set ultimo_numero = public.processo_instancia_counters.ultimo_numero + 1, updated_at = now()
  returning ultimo_numero into v_numero;
  return format('%s-%s-%s', v_prefixo, lpad(v_numero::text, 6, '0'), lpad(v_ano::text, 2, '0'));
end;
$function$;
