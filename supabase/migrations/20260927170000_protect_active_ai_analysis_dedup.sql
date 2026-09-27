create unique index if not exists ux_analise_ia_candidato_active
  on public.analise_ia_candidato (tenant_id, candidato_id, vaga_id)
  where status in ('pending', 'processing');
