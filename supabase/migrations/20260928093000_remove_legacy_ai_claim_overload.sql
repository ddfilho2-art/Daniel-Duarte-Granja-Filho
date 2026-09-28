-- Remove the historical pre-candidatura queue function overload.
-- The candidature-bound contract is the only supported application analysis API.
drop function if exists public.claim_ai_analysis_request(text, uuid, uuid, uuid, text, text, text, boolean);
