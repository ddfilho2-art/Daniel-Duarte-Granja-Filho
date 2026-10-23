-- Recruta AÍ Phase 2B / Step 1: additive schema expansion.
-- Creates only candidate signup settings/intents; leaves existing functions and policies untouched.

CREATE TABLE IF NOT EXISTS public.tenant_site_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  candidate_signup_enabled boolean NOT NULL DEFAULT true,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_site_settings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.tenant_site_settings FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.tenant_site_settings TO service_role;

-- A server-created, server-owned binding between a pending candidate registration
-- and the employer portal selected when the verification email was issued.
CREATE TABLE IF NOT EXISTS public.candidate_signup_intents (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'consumed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 minutes'),
  consumed_at timestamptz,
  PRIMARY KEY (user_id, tenant_id),
  CONSTRAINT candidate_signup_intents_expiry_after_creation CHECK (expires_at > created_at),
  CONSTRAINT candidate_signup_intents_status_timestamps CHECK (
    (status = 'pending' AND consumed_at IS NULL)
    OR (status = 'consumed' AND consumed_at IS NOT NULL)
  )
);

ALTER TABLE public.candidate_signup_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.candidate_signup_intents FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.candidate_signup_intents TO service_role;
CREATE INDEX IF NOT EXISTS candidate_signup_intents_tenant_idx
  ON public.candidate_signup_intents (tenant_id, expires_at)
  WHERE status = 'pending';
