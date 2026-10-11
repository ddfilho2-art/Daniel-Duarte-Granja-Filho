-- Align the legacy profile constraint with the clinic portal and its user-creation flow.
-- The UI routes /saude-ocupacional by perfil = 'Clinica', and the clinic-user-management
-- function persists that same value. The previous check constraint rejected it.
ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_perfil_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_perfil_check
  CHECK (perfil = ANY (ARRAY['Admin'::text, 'RH'::text, 'Candidato'::text, 'Clinica'::text]));
