-- ============================================================
-- Fix: AI career assistant credit counter resets after deploy
-- ============================================================
-- Root cause: the UPDATE RLS policy for `profiles` is missing in some
-- environments (only documented as a manual "Section 11" step in the
-- roadmap). Without it, the UPDATE silently affects 0 rows (data: null),
-- the UI optimistically shows the incremented value, and the DB still
-- stores the old value on the next render.
-- This migration makes the fix idempotent:
--   1) Ensures the UPDATE SELECT policy exists
--   2) Adds a SECURITY DEFINER RPC to atomically increment the counter

-- ============================================================
-- 1) Make sure the RLS UPDATE policy exists (idempotent)
-- ============================================================
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles
    FOR UPDATE TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- ============================================================
-- 2) Atomic increment function (fixes double-click race too:
--    two rapid requests would both read 0 and write 1; this makes it
--    correct because each increment updates in the DB).
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_ai_credits(target_user UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    new_value INTEGER;
BEGIN
    UPDATE public.profiles
    SET ai_credits_used = ai_credits_used + 1
    WHERE id = target_user
    RETURNING ai_credits_used INTO new_value;

    IF new_value IS NULL THEN
        RAISE EXCEPTION 'Profiles row not found for %', target_user;
    END IF;

    RETURN new_value;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_ai_credits(target_user UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_ai_credits(target_user UUID) TO authenticated;