-- O service_role é usado exclusivamente pelo harness E2E server-side.
-- A tabela permanece protegida por RLS para os papéis da aplicação; esta permissão
-- permite apenas a limpeza determinística das fixtures criadas pelo teste.
grant delete on table public.ai_analysis_requests to service_role;
