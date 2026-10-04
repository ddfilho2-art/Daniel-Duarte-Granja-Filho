-- The server-side E2E queue-load harness needs to insert synthetic jobs.
-- Keep RLS enabled and grant only the missing table privilege to service_role.
grant insert on table public.ai_analysis_requests to service_role;
