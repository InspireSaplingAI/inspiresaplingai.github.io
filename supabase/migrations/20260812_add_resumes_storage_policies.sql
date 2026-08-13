-- Storage RLS policies for the `resumes` bucket + resume analysis table (Phase 4D)
-- Run in Supabase SQL Editor

-- ============================================================
-- Storage: `resumes` bucket
-- ============================================================
-- IMPORTANT: Object paths written to the bucket must be RELATIVE to the
-- bucket (e.g. "<user-uuid>/<timestamp>-resume.pdf" — NO "resumes/" prefix).
-- The RLS policies below rely on the FIRST folder segment being the user's UUID.

INSERT INTO storage.buckets (id, name, public)
VALUES ('resumes', 'resumes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Users can upload their own resumes" ON storage.objects;
CREATE POLICY "Users can upload their own resumes"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can read their own resumes" ON storage.objects;
CREATE POLICY "Users can read their own resumes"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can update their own resumes" ON storage.objects;
CREATE POLICY "Users can update their own resumes"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Users can delete their own resumes" ON storage.objects;
CREATE POLICY "Users can delete their own resumes"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'resumes' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================
-- Table: resume_analyses
-- ============================================================

CREATE TABLE IF NOT EXISTS public.resume_analyses (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  storage_path    TEXT NOT NULL,
  job_title       TEXT,
  analysis_result JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.resume_analyses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own analyses" ON public.resume_analyses;
CREATE POLICY "Users can view own analyses"
ON public.resume_analyses FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own analyses" ON public.resume_analyses;
CREATE POLICY "Users can insert own analyses"
ON public.resume_analyses FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);