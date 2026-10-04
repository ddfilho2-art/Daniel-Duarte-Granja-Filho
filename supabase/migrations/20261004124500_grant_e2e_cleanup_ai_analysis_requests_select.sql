-- DELETE com filtro por request_key também exige SELECT sobre a coluna referenciada.
-- Mantemos RLS ativo e concedemos apenas a permissão necessária ao harness E2E server-side.
grant select on table public.ai_analysis_requests to service_role;
