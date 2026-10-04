-- A fila de IA usa esta chave no ON CONFLICT para manter uma análise
-- determinística por tenant, candidatura e snapshot de entrada.
alter table public.analise_ia_candidato
  add constraint analise_ia_candidato_tenant_candidatura_input_hash_key
  unique (tenant_id, candidatura_id, input_hash);
