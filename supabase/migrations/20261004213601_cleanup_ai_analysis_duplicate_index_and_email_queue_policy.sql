drop index if exists public.uq_analise_ia_input;

alter policy "deny_client_access"
on public.email_queue
to anon;
