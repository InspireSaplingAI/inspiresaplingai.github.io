-- ============================================================
-- PHASE 4E: Mentors & Coaching Sessions
-- ============================================================

CREATE TABLE IF NOT EXISTS public.mentor_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name            TEXT NOT NULL,
  bio             TEXT,
  company         TEXT,
  title           TEXT,
  expertise       TEXT[],
  avatar_url      TEXT,
  cal_link        TEXT,
  hourly_rate     INTEGER,           -- in USD cents (e.g. 5000 = $50)
  stripe_price_id TEXT,
  approved        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.mentor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view approved mentors" ON public.mentor_profiles FOR SELECT USING (approved = TRUE);
CREATE POLICY "Admins can manage mentors"        ON public.mentor_profiles FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);

CREATE TABLE IF NOT EXISTS public.coaching_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mentor_id           UUID NOT NULL REFERENCES public.mentor_profiles(id),
  member_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  booked_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  session_date        TIMESTAMPTZ,
  stripe_session_id   TEXT,
  stripe_payment_id   TEXT,
  status              TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'paid' | 'completed' | 'cancelled'
  amount_cents        INTEGER
);

ALTER TABLE public.coaching_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members view own sessions"  ON public.coaching_sessions FOR SELECT USING (auth.uid() = member_id);
CREATE POLICY "Members insert own session" ON public.coaching_sessions FOR INSERT WITH CHECK (auth.uid() = member_id);
CREATE POLICY "Admins view all sessions"   ON public.coaching_sessions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);