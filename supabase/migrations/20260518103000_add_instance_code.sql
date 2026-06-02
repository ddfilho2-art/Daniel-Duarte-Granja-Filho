-- Prefixo configurável por processo + código único de instância no formato PREFIXO-SEQUENCIAL-AA

alter table public.processos
  add column if not exists prefixo_instancia text;

alter table public.processo_instancias
  add column if not exists codigo_instancia text;

create table if not exists public.processo_instancia_counters (
  processo_id uuid not null references public.processos(id) on delete cascade,
  ano smallint not null,
  ultimo_numero integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (processo_id, ano)
);

create unique index if not exists uq_processo_instancias_codigo_instancia
  on public.processo_instancias(codigo_instancia)
  where codigo_instancia is not null;

create or replace function public.normalize_prefixo_instancia(raw_value text)
returns text
language plpgsql
as $$
declare
  normalized text;
begin
  normalized := regexp_replace(upper(coalesce(raw_value, '')), '[^A-Z0-9]+', '', 'g');

  if normalized is null or normalized = '' then
    normalized := 'PROC';
  end if;

  return left(normalized, 10);
end;
$$;

update public.processos
set prefixo_instancia = public.normalize_prefixo_instancia(nome)
where coalesce(trim(prefixo_instancia), '') = '';

create or replace function public.generate_codigo_instancia(p_processo_id uuid, p_iniciado_em timestamptz default now())
returns text
language plpgsql
as $$
declare
  v_prefixo text;
  v_ano smallint;
  v_numero integer;
begin
  select public.normalize_prefixo_instancia(prefixo_instancia)
    into v_prefixo
  from public.processos
  where id = p_processo_id;

  if v_prefixo is null then
    raise exception 'Processo % não encontrado para geração de código da instância', p_processo_id;
  end if;

  v_ano := (extract(year from coalesce(p_iniciado_em, now()))::integer % 100)::smallint;

  insert into public.processo_instancia_counters (processo_id, ano, ultimo_numero)
  values (p_processo_id, v_ano, 1)
  on conflict (processo_id, ano)
  do update
    set ultimo_numero = public.processo_instancia_counters.ultimo_numero + 1,
        updated_at = now()
  returning ultimo_numero into v_numero;

  return format('%s-%s-%s', v_prefixo, lpad(v_numero::text, 6, '0'), lpad(v_ano::text, 2, '0'));
end;
$$;

with ranked as (
  select
    pi.id,
    pi.processo_id,
    coalesce(pi.iniciado_em, pi.created_at, now()) as iniciado_ref,
    (extract(year from coalesce(pi.iniciado_em, pi.created_at, now()))::integer % 100)::smallint as ano,
    row_number() over (
      partition by pi.processo_id, (extract(year from coalesce(pi.iniciado_em, pi.created_at, now()))::integer % 100)
      order by coalesce(pi.iniciado_em, pi.created_at, now()), pi.id
    ) as seq
  from public.processo_instancias pi
), coded as (
  select
    r.id,
    format(
      '%s-%s-%s',
      public.normalize_prefixo_instancia(p.prefixo_instancia),
      lpad(r.seq::text, 6, '0'),
      lpad(r.ano::text, 2, '0')
    ) as codigo
  from ranked r
  join public.processos p on p.id = r.processo_id
)
update public.processo_instancias pi
set codigo_instancia = c.codigo
from coded c
where pi.id = c.id
  and coalesce(trim(pi.codigo_instancia), '') = '';

insert into public.processo_instancia_counters (processo_id, ano, ultimo_numero)
select
  processo_id,
  (extract(year from coalesce(iniciado_em, created_at, now()))::integer % 100)::smallint as ano,
  max(
    nullif(
      split_part(codigo_instancia, '-', 2),
      ''
    )::integer
  ) as ultimo_numero
from public.processo_instancias
where codigo_instancia is not null
group by processo_id, (extract(year from coalesce(iniciado_em, created_at, now()))::integer % 100)::smallint
on conflict (processo_id, ano)
do update
  set ultimo_numero = excluded.ultimo_numero,
      updated_at = now();
