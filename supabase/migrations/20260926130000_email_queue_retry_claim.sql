-- SEC-007: lease/claim fields for the legacy email queue.
-- This migration is intentionally defensive because DB-007 has not yet
-- established a complete declarative baseline of the remote legacy schema.

do $$
begin
  if to_regclass('public.email_queue') is not null then
    alter table public.email_queue
      add column if not exists processing_token uuid,
      add column if not exists processing_started_at timestamptz;

    create index if not exists idx_email_queue_processing_lease
      on public.email_queue(processing_started_at)
      where processing_token is not null;
  end if;
end
$$;
