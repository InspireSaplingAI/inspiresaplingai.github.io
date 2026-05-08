# Phase 4 Implementation Roadmap
## InspireSaplingAI Membership Platform

> **Purpose:** This document is the complete technical specification for implementing Phase 4 of the InspireSaplingAI website. It is designed to be handed directly to an AI coding agent (or developer) on a dedicated feature branch.
>
> **Current state:** The site is a static Astro + Tailwind site hosted on GitHub Pages. Phases 1–3 are complete. Phase 4 placeholder pages exist at `/membership`, `/donate`, `/forum`, `/volunteer`. Actual functionality is stubbed.
>
> **Branch convention:** Create a branch called `feat/phase-4a-auth` (and so on per sub-phase) off `main`. Each sub-phase should be a clean PR.

---

## Table of Contents

1. [Pre-flight Checklist — Manual Account Setup](#1-pre-flight-checklist--manual-account-setup)
2. [Tech Stack Reference](#2-tech-stack-reference)
3. [Cost Reference](#3-cost-reference)
4. [Phase 4A — Foundation: Vercel + Supabase Auth](#4-phase-4a--foundation-vercel--supabase-auth)
5. [Phase 4B — Event Registration](#5-phase-4b--event-registration)
6. [Phase 4C — Donations (Donorbox)](#6-phase-4c--donations-donorbox)
7. [Phase 4D — AI Career Assistant](#7-phase-4d--ai-career-assistant)
8. [Phase 4E — 1-on-1 Coaching (Cal.com + Stripe)](#8-phase-4e--1-on-1-coaching-calcom--stripe)
9. [Phase 4F — Community Forum (giscus)](#9-phase-4f--community-forum-giscus)
10. [Phase 4G — Volunteer Management](#10-phase-4g--volunteer-management)
11. [Database Schema — Full SQL](#11-database-schema--full-sql)
12. [Environment Variables Reference](#12-environment-variables-reference)
13. [Build Order & Dependencies](#13-build-order--dependencies)

---

## 1. Pre-flight Checklist — Manual Account Setup

> **All items in this section are 👤 MANUAL — must be done by the org owner before any code is written for Phase 4A.**
> Agent cannot complete these steps. They require human login, form submission, or payment.

### 1.1 Vercel (required for Phase 4A)
- [ ] Go to [vercel.com](https://vercel.com) → Sign up with GitHub account
- [ ] Click **Add New Project** → Import `InspireSaplingAI/inspiresaplingai.github.io`
- [ ] Framework preset: **Astro** (Vercel detects automatically)
- [ ] Leave build settings as-is, click **Deploy** — first deploy will succeed (static mode still works)
- [ ] After agent adds `@astrojs/vercel` adapter: Vercel redeploys automatically on every `git push main`
- [ ] **Disable GitHub Pages** after confirming Vercel deploy works (repo Settings → Pages → Source → None)

### 1.2 Supabase (required for Phase 4A)
- [ ] Go to [supabase.com](https://supabase.com) → Sign up (free)
- [ ] Click **New Project** → name it `inspiresaplingai` → choose nearest region → set a strong DB password (save it!)
- [ ] Wait ~2 minutes for provisioning
- [ ] Go to **Project Settings → API** and copy:
  - `SUPABASE_URL` (looks like `https://xxxxx.supabase.co`)
  - `SUPABASE_ANON_KEY` (public, safe for frontend)
  - `SUPABASE_SERVICE_ROLE_KEY` (secret — only for server-side API routes, never expose to frontend)
- [ ] Add all three to Vercel: Project → Settings → Environment Variables
- [ ] In Supabase: **Authentication → Providers → Email** — confirm it is enabled (it is by default)
- [ ] In Supabase: **Authentication → URL Configuration** → set **Site URL** to `https://inspiresaplingai.github.io` (update to Vercel URL once live)
- [ ] In Supabase: set **Redirect URLs** to include `https://YOUR_VERCEL_URL/auth/callback`

### 1.3 Resend (required for Phase 4B — email confirmations)
- [ ] Go to [resend.com](https://resend.com) → Sign up (free tier: 100 emails/day, 3,000/month)
- [ ] Verify a sending domain (requires DNS access to your domain, OR use `onboarding@resend.dev` for testing)
- [ ] Create an API key → copy as `RESEND_API_KEY`
- [ ] Add to Vercel environment variables

### 1.4 OpenAI (required for Phase 4D)
- [ ] Go to [platform.openai.com](https://platform.openai.com) → Sign up / log in
- [ ] Navigate to **API Keys** → Create new secret key → copy as `OPENAI_API_KEY`
- [ ] Set a **Usage Limit** (recommended: $10/month hard limit to prevent surprises)
- [ ] Add to Vercel environment variables (server-side only — never expose in frontend code)

### 1.5 RapidAPI / JSearch (required for Phase 4D — job search)
- [ ] Go to [rapidapi.com](https://rapidapi.com) → Sign up
- [ ] Search for **JSearch** → Subscribe to **Basic plan** (500 free requests/month)
- [ ] Copy `X-RapidAPI-Key` → save as `RAPIDAPI_KEY`
- [ ] Add to Vercel environment variables

### 1.6 Stripe (required for Phase 4E — coaching payments)
> ⚠️ **Do this AFTER non-profit registration is complete.**
- [ ] Go to [stripe.com](https://stripe.com) → Create account as a non-profit
- [ ] Complete business verification with EIN and non-profit documentation
- [ ] Go to **Developers → API Keys** → copy `STRIPE_SECRET_KEY` (live mode)
- [ ] Go to **Developers → Webhooks** → Add endpoint `https://YOUR_VERCEL_URL/api/stripe/webhook` → select events: `checkout.session.completed`, `payment_intent.succeeded`
- [ ] Copy **Webhook Signing Secret** → save as `STRIPE_WEBHOOK_SECRET`
- [ ] Add both to Vercel environment variables

### 1.7 Donorbox (required for Phase 4C — donations)
> ⚠️ **Do this AFTER non-profit registration is complete.**
- [ ] Go to [donorbox.org](https://donorbox.org) → Sign up as a non-profit (requires 501c3 documentation)
- [ ] Create a campaign with one-time and monthly donation options
- [ ] From the campaign page: click **Embed** → copy the `<script>` and `<iframe>` embed code
- [ ] Save the embed code — the agent will paste it into `src/pages/donate.astro`
- [ ] No API key needed — it's purely an embed widget

### 1.8 GitHub Discussions (required for Phase 4F)
- [ ] Go to the GitHub repo → **Settings** → scroll to **Features** section
- [ ] Enable **Discussions**
- [ ] Click the new **Discussions** tab → create these categories:
  - 📚 AI Learning & Resources
  - 💼 Career & Job Search
  - 📅 Events & Programs
  - 🔬 AI Research Corner
  - 🤝 Project Collaboration
  - 💬 General Discussion

### 1.9 giscus (required for Phase 4F — forum embed)
- [ ] Go to [giscus.app](https://giscus.app)
- [ ] Enter repo: `InspireSaplingAI/inspiresaplingai.github.io`
- [ ] Select **Discussion category**: General Discussion (or create a "Comments" category)
- [ ] Page ↔ Discussion mapping: **pathname**
- [ ] Theme: **preferred_color_scheme**
- [ ] Copy the generated `<script>` tag — the agent will paste it into `src/pages/forum.astro`
- [ ] Install the **giscus GitHub App** on the repo (link shown on giscus.app)

### 1.10 Cal.com (required for Phase 4E — coaching booking; per mentor)
> Each mentor sets up their own Cal.com account independently.
- [ ] Each mentor: go to [cal.com](https://cal.com) → Sign up (free)
- [ ] Set availability and create a "1-on-1 Coaching" event type (60 min)
- [ ] Copy their booking URL (e.g., `https://cal.com/mentor-name/coaching`)
- [ ] Admin: paste the Cal.com URL into the mentor's row in the `mentor_profiles` Supabase table

---

## 2. Tech Stack Reference

| Layer | Technology | Why |
|-------|-----------|-----|
| Framework | Astro 5 with `output: 'hybrid'` | Static pages stay static; API routes are server-rendered. No full SPA needed. |
| Hosting | Vercel (free tier) | The only free platform that supports Astro SSR API routes with zero config. |
| Database + Auth | Supabase (free tier) | PostgreSQL + built-in auth + storage + row-level security in one free service. |
| Email | Resend (free tier) | Modern email API, 3K/month free, excellent deliverability. |
| AI | OpenAI GPT-4o mini | Cheapest capable model (~$0.15/1M tokens). A resume analysis costs ~$0.0003. |
| Job Search | JSearch via RapidAPI | Real job listings, 500 free requests/month. |
| Payments | Stripe | Industry standard, non-profit rates available (2.2% + $0.30). |
| Donations | Donorbox | Purpose-built for non-profits. No monthly fee. 1.5% platform fee. |
| Booking | Cal.com | Free for individual mentors. Zero integration work (just embed the link). |
| Forum | giscus.app | GitHub Discussions-powered. Zero backend. Free forever. |
| File Storage | Supabase Storage | Resume uploads stored with per-user RLS. Included in free tier. |

### Why NOT the alternatives
- **Discord SDK**: Requires users to have Discord, adds authentication complexity, not accessible
- **Cloudinary**: Redundant — Supabase Storage handles the same use case for free
- **Firebase**: More complex pricing, less transparent, harder to query with SQL
- **Auth0**: Generous free tier but overkill when Supabase Auth is already included

---

## 3. Cost Reference

> All costs assuming ~500 monthly active users at launch.

| Service | Free Tier | Estimated Cost at 500 MAU |
|---------|-----------|--------------------------|
| Vercel | 100GB bandwidth, unlimited builds | $0 |
| Supabase | 500MB DB, 50K MAU, 1GB storage | $0 |
| Resend | 3,000 emails/month | $0 |
| OpenAI | Pay-per-use | ~$0.15 (500 users × 3 analyses × ~$0.0001) |
| RapidAPI JSearch | 500 calls/month | $0 (upgrade ~$10/month if exceeded) |
| Stripe | 2.2% + $0.30 per transaction | Only when coaching sessions are booked |
| Donorbox | 1.5% platform fee | Only when donations come in |
| Cal.com | Free per mentor | $0 |
| giscus | Free | $0 |
| **Total** | | **~$0–10/month** |

---

## 4. Phase 4A — Foundation: Vercel + Supabase Auth

> **Dependencies:** Pre-flight items 1.1 and 1.2 must be complete.
> **Branch:** `feat/phase-4a-auth`

### 4.1 👤 Manual Steps (before agent starts)
- Complete pre-flight 1.1 (Vercel) and 1.2 (Supabase)
- Have `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` ready in Vercel env vars
- Run this SQL in Supabase SQL Editor (Project → SQL Editor → New query):

```sql
-- See full SQL in Section 11
```

### 4.2 🤖 Agent Steps

**New packages to install:**
```bash
npm install @astrojs/vercel @supabase/supabase-js @supabase/ssr
```

**Files to create:**

| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Browser-side Supabase client (uses `createBrowserClient`) |
| `src/lib/supabase-server.ts` | Server-side Supabase client (uses `createServerClient` with cookies) |
| `src/middleware.ts` | Reads session from cookies, injects `locals.user`; redirects unauthenticated users away from `/dashboard/*` |
| `src/pages/auth/login.astro` | Login form (email + password) + "Sign in with Google" button |
| `src/pages/auth/signup.astro` | Sign-up form (name + email + password) |
| `src/pages/auth/callback.astro` | OAuth callback handler — exchanges code for session, redirects to `/dashboard` |
| `src/pages/auth/logout.astro` | POST endpoint that clears session cookies and redirects to `/` |
| `src/pages/dashboard/index.astro` | Member dashboard: name, email, registered events, AI credits remaining |
| `src/components/auth/UserMenu.astro` | Navbar dropdown for logged-in users (avatar, "Dashboard", "Sign Out") |

**Files to modify:**

| File | Change |
|------|--------|
| `astro.config.mjs` | Add `@astrojs/vercel` adapter, set `output: 'hybrid'` |
| `src/components/Navbar.astro` | Import `UserMenu.astro`; show Login button when logged out, `UserMenu` when logged in. Read `Astro.locals.user` via props. |

**Key implementation notes for agent:**
- Use `@supabase/ssr` (not the deprecated `@supabase/auth-helpers-astro`) for cookie-based sessions
- The middleware must call `supabase.auth.getUser()` (not `getSession()`) — `getSession()` trusts the JWT without server-side validation
- Route protection: redirect `request.url` to `/auth/login?next=<encoded-url>` and restore after login
- After signup, Supabase sends a confirmation email automatically — no extra code needed
- Create the `profiles` row on `auth.users` insert via a Supabase Database Trigger (SQL in Section 11)

### 4.3 Verification Checklist
- [ ] `npm run build` — 0 errors
- [ ] Sign up with a new email → confirmation email arrives → click link → redirected to `/dashboard`
- [ ] Log out → `/dashboard` redirects to `/auth/login`
- [ ] Log in again → redirected back to `/dashboard`
- [ ] `profiles` row exists in Supabase for the new user

---

## 5. Phase 4B — Event Registration

> **Dependencies:** Phase 4A complete. Pre-flight 1.3 (Resend) complete.
> **Branch:** `feat/phase-4b-events`

### 5.1 👤 Manual Steps
- Complete pre-flight 1.3 (Resend) and add `RESEND_API_KEY` to Vercel env vars
- Run this SQL in Supabase SQL Editor to create the table and RLS (see Section 11)

### 5.2 🤖 Agent Steps

**New packages:**
```bash
npm install resend
```

**Files to create:**

| File | Purpose |
|------|---------|
| `src/pages/api/events/register.ts` | POST API route: validates session, checks for duplicate registration, inserts `event_registrations` row, sends confirmation email via Resend |
| `src/pages/dashboard/events.astro` | "My Events" dashboard sub-page: lists user's registrations with date, status, and cancel option |

**Files to modify:**

| File | Change |
|------|--------|
| `src/components/events/EventCard.astro` | "Register Now" button: if `status === 'upcoming'` and no `external_url`, POST to `/api/events/register` with event slug. If not logged in, redirect to `/auth/login?next=/events`. Show "Registered ✓" state after success. |
| `src/pages/dashboard/index.astro` | Add "My Events" module showing count of upcoming registrations with link to `/dashboard/events` |

**Email template (plain text, send via Resend):**
```
Subject: You're registered for {event.title}!

Hi {user.name},

You're confirmed for: {event.title}
Date: {event.date} at {event.time}
Location: {event.location}

We'll send a reminder 24 hours before the event.

— InspireSaplingAI Team
```

### 5.3 Verification Checklist
- [ ] Log in → go to `/events` → click Register → `event_registrations` row created in Supabase
- [ ] Confirmation email received
- [ ] Button shows "Registered ✓" on return visit
- [ ] Can't register for the same event twice (API returns 409)
- [ ] Unauthenticated user clicking Register is redirected to login then back

---

## 6. Phase 4C — Donations (Donorbox)

> **Dependencies:** Non-profit 501(c)(3) registration complete. Pre-flight 1.7 (Donorbox) complete.
> **Branch:** `feat/phase-4c-donations`
> ⚠️ This phase has no code dependencies on 4A or 4B. It can be done any time after Donorbox account is set up.

### 6.1 👤 Manual Steps
- Complete Donorbox account setup (pre-flight 1.7)
- Copy the embed code from the Donorbox campaign page
- Provide the embed code to the agent

### 6.2 🤖 Agent Steps

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/donate.astro` | Replace the two disabled "Coming Soon" buttons with the Donorbox `<script>` + `<iframe>` embed. Remove the amber "registration in progress" warning banner. Keep the "Where Your Money Goes" section. |

No new packages. No API routes. No database tables (Donorbox handles all of this internally). One-page change.

### 6.3 Verification Checklist
- [ ] `/donate` shows the Donorbox widget
- [ ] Test donation completes (use Donorbox test mode)
- [ ] Donor receives a receipt email from Donorbox

---

## 7. Phase 4D — AI Career Assistant

> **Dependencies:** Phase 4A complete. Pre-flight 1.4 (OpenAI) and 1.5 (RapidAPI) complete.
> **Branch:** `feat/phase-4d-ai-career`
> ⚠️ This is the most complex phase. Build and test locally before deploying.

### 7.1 👤 Manual Steps
- Complete pre-flight 1.4 (OpenAI) and 1.5 (RapidAPI)
- In Supabase: **Storage** → New bucket → name `resumes` → set to **private**
- Run SQL to create `resume_analyses` table and RLS (see Section 11)
- Set OpenAI usage limit to $10/month in OpenAI dashboard (safety measure)

### 7.2 🤖 Agent Steps

**New packages:**
```bash
npm install openai pdf-parse
```

**Files to create:**

| File | Purpose |
|------|---------|
| `src/pages/dashboard/career.astro` | Main UI: resume upload form, job target input, results display area, usage counter ("X of 3 free analyses used") |
| `src/pages/api/ai/analyze-resume.ts` | POST API route (server-side): reads uploaded file from Supabase Storage → extracts text via `pdf-parse` → sends to OpenAI → saves result to `resume_analyses` → increments `profiles.ai_credits_used` → returns JSON |
| `src/pages/api/ai/upload-resume.ts` | POST API route: receives `multipart/form-data`, validates file type (PDF/DOCX only) and size (max 5MB), uploads to Supabase Storage at `resumes/{user_id}/{timestamp}.pdf`, returns storage path |
| `src/pages/api/jobs/search.ts` | GET API route: proxies JSearch API with user's job title and location params → returns top 10 matching jobs. Caches results for 1 hour using Vercel edge cache headers. |

**OpenAI prompt template (in `analyze-resume.ts`):**
```
You are an expert career coach and technical recruiter. Analyze the following resume and target job description.

Return a JSON object with these fields:
- strengths: string[] (3-5 key strengths from the resume)
- gaps: string[] (3-5 missing skills or experiences for the target role)  
- rewrite_suggestions: { section: string, original: string, improved: string }[] (top 3 specific rewrites)
- overall_score: number (1-10, how well the resume matches the role)
- summary: string (2-3 sentence overall assessment)

Resume:
{resume_text}

Target role: {job_title}
```

**Usage control logic (in `analyze-resume.ts`):**
```typescript
const { data: profile } = await supabase
  .from('profiles')
  .select('ai_credits_used')
  .eq('id', user.id)
  .single();

if (profile.ai_credits_used >= 3) {
  return new Response(JSON.stringify({ error: 'free_limit_reached' }), { status: 429 });
}
```

**Security requirements:**
- `OPENAI_API_KEY` must ONLY appear in server-side API route files (never in `.astro` frontmatter or client `<script>` tags)
- Validate file MIME type server-side (not just by extension) before processing
- Max file size: 5MB — enforce in the upload route, not just the frontend
- RLS on `resume_analyses`: users can only SELECT/INSERT their own rows

### 7.3 Verification Checklist
- [ ] Upload a PDF resume, set a job title → analysis returns within 10 seconds
- [ ] Results show strengths, gaps, and rewrite suggestions
- [ ] Usage counter increments correctly
- [ ] 4th attempt returns a 429 with "free limit reached" message
- [ ] User cannot access another user's resume via storage path (RLS test)
- [ ] `OPENAI_API_KEY` does NOT appear in any client-side JS bundle (`npm run build` + check `dist/`)

---

## 8. Phase 4E — 1-on-1 Coaching (Cal.com + Stripe)

> **Dependencies:** Phase 4A complete. Pre-flight 1.6 (Stripe) and 1.10 (Cal.com per mentor) complete.
> **Branch:** `feat/phase-4e-coaching`

### 8.1 👤 Manual Steps
- Complete Stripe setup (pre-flight 1.6) after non-profit registration
- For each mentor: complete Cal.com setup (pre-flight 1.10)
- Run SQL to create `mentor_profiles` and `coaching_sessions` tables (see Section 11)
- In Supabase: manually insert each approved mentor into `mentor_profiles` table (or use Supabase Studio)
- In Stripe: create a **Price** for each mentor's hourly rate (e.g., $50/hr = Price ID `price_xxxxx`)
  - Go to Stripe Dashboard → Products → Add Product → set recurring = false, price = mentor's rate
  - Copy the `Price ID` and add it to the mentor's `mentor_profiles.stripe_price_id` column

### 8.2 🤖 Agent Steps

**New packages:**
```bash
npm install stripe
```

**Files to create:**

| File | Purpose |
|------|---------|
| `src/pages/mentors/index.astro` | Mentor directory: grid of approved mentor cards with photo, bio, expertise tags, hourly rate, and "Book a Session" button |
| `src/pages/mentors/[id].astro` | Mentor detail page: full bio, `<iframe>` Cal.com embed for booking, Stripe payment link |
| `src/pages/api/coaching/create-checkout.ts` | POST API route: creates a Stripe Checkout Session for the mentor's price, redirects user to Stripe-hosted payment page. Success URL: `/dashboard?booked=true` |
| `src/pages/api/stripe/webhook.ts` | POST API route: receives Stripe webhook events, verifies signature using `STRIPE_WEBHOOK_SECRET`, updates `coaching_sessions.status = 'paid'` on `checkout.session.completed` |
| `src/pages/dashboard/coaching.astro` | "My Sessions" dashboard sub-page: upcoming and past coaching sessions |

**Pricing transparency note:** The mentor directory should clearly display:
- Mentor's hourly rate
- A disclosure: *"Sessions are fee-based. Proceeds support mentor stipends and InspireSaplingAI operations."*

### 8.3 Verification Checklist
- [ ] Mentor directory shows all `approved = true` mentors
- [ ] Cal.com calendar loads in mentor detail page
- [ ] "Book & Pay" triggers Stripe Checkout
- [ ] Test payment completes → `coaching_sessions` row has `status = 'paid'`
- [ ] Stripe webhook signature verification passes (test with Stripe CLI)

---

## 9. Phase 4F — Community Forum (giscus)

> **Dependencies:** Pre-flight 1.8 (GitHub Discussions) and 1.9 (giscus) complete.
> **Branch:** `feat/phase-4f-forum`
> This is the simplest phase — roughly 30 minutes of agent work.

### 9.1 👤 Manual Steps
- Enable GitHub Discussions and create categories (pre-flight 1.8)
- Configure giscus.app and copy the generated `<script>` tag (pre-flight 1.9)
- Provide the `<script>` tag to the agent

### 9.2 🤖 Agent Steps

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/forum.astro` | Replace the placeholder content with the giscus `<script>` tag embed inside a `<div>` container. Keep the hero section. Remove "coming soon" language. Update the "Join us on GitHub Discussions" link to the specific Discussions URL. |

No new packages. No API routes. No database changes.

### 9.3 Verification Checklist
- [ ] Forum page loads the giscus comment box
- [ ] Sign in with GitHub → can post a comment
- [ ] Comment appears in GitHub Discussions

---

## 10. Phase 4G — Volunteer Management

> **Dependencies:** Phase 4A complete. Pre-flight 1.3 (Resend) complete.
> **Branch:** `feat/phase-4g-volunteer`

### 10.1 👤 Manual Steps
- Run SQL to create `volunteer_applications` table (see Section 11)
- Decide which email address to receive volunteer application notifications (set as `ADMIN_EMAIL` env var in Vercel)

### 10.2 🤖 Agent Steps

**Files to create:**

| File | Purpose |
|------|---------|
| `src/pages/volunteer/apply.astro` | Application form: name, email, role selection (dropdown), skills (textarea), availability, motivation (textarea). Submits to `/api/volunteer/apply`. |
| `src/pages/volunteer/thank-you.astro` | Confirmation page shown after successful application |
| `src/pages/api/volunteer/apply.ts` | POST API route: validates inputs, inserts `volunteer_applications` row, sends notification email to admin via Resend, redirects to `/volunteer/thank-you` |
| `src/pages/admin/volunteers.astro` | Simple admin table (auth-gated, role = 'admin'): shows all applications with status, allow status update to 'approved' / 'rejected'. Initial implementation uses Supabase client-side SDK for simplicity. |

**Files to modify:**

| File | Change |
|------|--------|
| `src/pages/volunteer/index.astro` | Change "Apply via Contact Form" buttons to link to `/volunteer/apply` instead of `/#contact`. Remove the amber "application form coming soon" banner. |

**Admin role setup (👤 manual):**
After Phase 4A is live, set the org owner's user role in Supabase:
```sql
UPDATE profiles SET role = 'admin' WHERE email = 'your-email@example.com';
```

### 10.3 Verification Checklist
- [ ] Submit application form → row appears in `volunteer_applications` in Supabase
- [ ] Admin email receives notification with applicant details
- [ ] Applicant redirected to thank-you page
- [ ] Admin at `/admin/volunteers` can see and update application status
- [ ] Non-admin user cannot access `/admin/volunteers` (redirected to `/dashboard`)

---

## 11. Database Schema — Full SQL

> **Run in Supabase SQL Editor (Project → SQL Editor → New query → paste → Run).**
> Run the entire block at once, or phase by phase as needed.

```sql
-- ============================================================
-- PHASE 4A: Profiles (run when starting Phase 4A)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  avatar_url  TEXT,
  bio         TEXT,
  role        TEXT NOT NULL DEFAULT 'member',   -- 'member' | 'admin'
  ai_credits_used INTEGER NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"     ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"   ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles"   ON public.profiles FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);


-- ============================================================
-- PHASE 4B: Event Registrations
-- ============================================================

CREATE TABLE IF NOT EXISTS public.event_registrations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_slug  TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'confirmed',  -- 'confirmed' | 'cancelled'
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, event_slug)
);

ALTER TABLE public.event_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own registrations"   ON public.event_registrations FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own registrations" ON public.event_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own registrations" ON public.event_registrations FOR UPDATE USING (auth.uid() = user_id);


-- ============================================================
-- PHASE 4D: Resume Analyses
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
CREATE POLICY "Users can view own analyses"   ON public.resume_analyses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own analyses" ON public.resume_analyses FOR INSERT WITH CHECK (auth.uid() = user_id);


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


-- ============================================================
-- PHASE 4G: Volunteer Applications
-- ============================================================

CREATE TABLE IF NOT EXISTS public.volunteer_applications (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  email        TEXT NOT NULL,
  role         TEXT NOT NULL,
  skills       TEXT,
  availability TEXT,
  motivation   TEXT,
  status       TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  applied_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.volunteer_applications ENABLE ROW LEVEL SECURITY;
-- Unauthenticated users can submit applications (no login required)
CREATE POLICY "Anyone can insert applications" ON public.volunteer_applications FOR INSERT WITH CHECK (TRUE);
-- Only admins can read applications
CREATE POLICY "Admins can view applications"   ON public.volunteer_applications FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update applications" ON public.volunteer_applications FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
);
```

---

## 12. Environment Variables Reference

> Add all of these to Vercel: Project → Settings → Environment Variables.
> The `.env.example` file in the repo contains all keys (without values) for reference.

| Variable | Phase | Where to get it | Exposed to frontend? |
|----------|-------|----------------|----------------------|
| `PUBLIC_SUPABASE_URL` | 4A | Supabase → Settings → API | ✅ Yes (prefix `PUBLIC_`) |
| `PUBLIC_SUPABASE_ANON_KEY` | 4A | Supabase → Settings → API | ✅ Yes (prefix `PUBLIC_`) |
| `SUPABASE_SERVICE_ROLE_KEY` | 4A | Supabase → Settings → API | ❌ Server only |
| `RESEND_API_KEY` | 4B | Resend → API Keys | ❌ Server only |
| `OPENAI_API_KEY` | 4D | OpenAI → API Keys | ❌ Server only — critical |
| `RAPIDAPI_KEY` | 4D | RapidAPI → Apps | ❌ Server only |
| `STRIPE_SECRET_KEY` | 4E | Stripe → Developers | ❌ Server only |
| `STRIPE_WEBHOOK_SECRET` | 4E | Stripe → Webhooks | ❌ Server only |
| `ADMIN_EMAIL` | 4G | Your choice | ❌ Server only |

> ⚠️ Variables without `PUBLIC_` prefix are NEVER accessible in client-side code in Astro. The `PUBLIC_` prefix is required for any variable that needs to be read in a `<script>` tag or browser context.

---

## 13. Build Order & Dependencies

```
Pre-flight 1.1 (Vercel) ─────┐
Pre-flight 1.2 (Supabase) ───┴──► Phase 4A (Auth/Foundation) ──────────────────────────────────┐
                                                                                                  │
                                                                ┌─────────────────────────────────┤
                                                                │                                 │
Pre-flight 1.3 (Resend) ─────────────────────────────────► Phase 4B (Events) ◄──────────────────┤
                                                                                                  │
Non-profit registration ──► Pre-flight 1.7 (Donorbox) ──► Phase 4C (Donations) ◄────────────────┤
                                                                                                  │
Pre-flight 1.4 (OpenAI)  ────────────────────────────────► Phase 4D (AI Career) ◄───────────────┤
Pre-flight 1.5 (RapidAPI) ───────────────────────────────┘                                       │
                                                                                                  │
Non-profit reg + Pre-flight 1.6 (Stripe) + 1.10 (Cal.com) ──► Phase 4E (Coaching) ◄─────────────┤
                                                                                                  │
Pre-flight 1.8 (GitHub Discussions) ─────────────────────► Phase 4F (Forum) ◄───────────────────┤
Pre-flight 1.9 (giscus) ─────────────────────────────────┘                                       │
                                                                                                  │
Pre-flight 1.3 (Resend) ─────────────────────────────────► Phase 4G (Volunteer) ◄───────────────┘
```

**Minimum viable first release:** Complete Phase 4A + Phase 4B + Phase 4F. This gives users: login, event registration, and community discussion — meaningful interactivity with near-zero cost.

**Recommended order for parallel work:**
1. Start with 4A (blocks everything else)
2. Once 4A is deployed: 4B, 4C, 4F can be built simultaneously by different contributors
3. 4D and 4E require more setup time (API keys + external accounts) — start those after 4B is stable

---

*Last updated: May 2026 — Phase 3 complete, Phase 4 pending non-profit registration and Vercel migration.*
