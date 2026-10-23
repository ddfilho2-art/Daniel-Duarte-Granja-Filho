-- Bootstrap for an isolated test Supabase project only; never run in production.
-- Prefix this script with: SET app.recruta_test_project_ref = '<verified-test-project-ref>';
DO $setup$
DECLARE v_project_ref text := lower(trim(COALESCE(current_setting('app.recruta_test_project_ref', true), '')));
BEGIN
  IF v_project_ref = '' OR v_project_ref = 'dmzagrakkduddofkqjhg'
     OR v_project_ref LIKE 'replace%' OR v_project_ref !~ '^[a-z0-9-]{6,80}$' THEN
    RAISE EXCEPTION 'Refused: provide the verified non-production project ref in app.recruta_test_project_ref.';
  END IF;
  EXECUTE 'CREATE SCHEMA IF NOT EXISTS test';
  EXECUTE 'CREATE TABLE IF NOT EXISTS test.phase2b_environment_marker (
    environment text PRIMARY KEY CHECK (environment = ''isolated-test''),
    project_ref text NOT NULL CHECK (project_ref <> ''dmzagrakkduddofkqjhg''),
    created_at timestamptz NOT NULL DEFAULT now()
  )';
  EXECUTE 'CREATE TABLE IF NOT EXISTS test.phase2b_accounts (
    email text PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE
  )';
  EXECUTE 'INSERT INTO test.phase2b_environment_marker(environment,project_ref)
    VALUES (''isolated-test'',$1)
    ON CONFLICT(environment) DO UPDATE SET project_ref=EXCLUDED.project_ref,created_at=now()'
    USING v_project_ref;
END;
$setup$;
