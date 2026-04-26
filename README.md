# InspoMe

> Why does this saved video work, and what can I learn from it to make better content?

InspoMe is a mobile-first Next.js app that helps creators save TikTok and Instagram inspiration, then breaks down each video's hook, structure, visuals, audio, editing, performance hypothesis, and reusable creative pattern.

This is the Phase 1 MVP scaffold. Cobalt (media download) and Gemini (analysis) are stubbed behind a swappable provider interface so the full UX can be exercised without external dependencies.

## Stack

- **Next.js 16** (App Router, `proxy.ts`, Turbopack)
- **React 19** + **TypeScript**
- **Tailwind CSS v4** (OKLCH design tokens, dark-mode ready)
- **Supabase** — Auth (magic link + Google), Postgres with RLS, Storage
- **shadcn-style** local primitives (Button, Input, Card, Badge, Textarea, ChipPicker)
- **Zod** for API validation

## Architecture

```
React app
  → Next.js route handlers (validate + auth-check)
  → content_ingestion_service (queue + state machine)
  → MediaDownloadProvider (StubCobalt → real Cobalt fork in Phase 2)
  → VideoAnalysisProvider (StubGemini → real Gemini in Phase 2)
  → Supabase Postgres (RLS-enforced reads, service-role writes for jobs)
  → progressive UI updates via polling
```

See `src/server/ingestion/` for the abstraction. Cobalt is **never** called from frontend code per the spec invariant.

## Setup

### 1. Fill in `.env.local`

Open `.env.local` and paste your Supabase project URL, anon key, and service-role key from `https://supabase.com/dashboard/project/<id>/settings/api`.

### 2. Apply the database migration

Either via the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

…or by copying `supabase/migrations/20260426000000_init_inspome_schema.sql` into the Supabase SQL editor and running it.

This creates: `users`, `inspo`, `ingestion_jobs`, `video_analysis`, `platform_metrics`, `event_log`, with all enums, triggers (auto-create profile on signup), and RLS policies.

### 3. Configure Supabase Auth

In your Supabase dashboard:

- **Providers → Email**: enable magic link
- **Providers → Google**: enable and add OAuth client ID/secret
- **URL Configuration → Site URL**: `http://localhost:3000`
- **URL Configuration → Redirect URLs**: add `http://localhost:3000/auth/callback`

### 4. Run

```bash
npm run dev
```

Open `http://localhost:3000`. You'll be redirected to `/login`, then through onboarding, then to your library.

## App routes

| Route | What it does |
|------|-------------|
| `/` | Auth-aware home — redirects to `/login`, `/onboarding`, or `/library` |
| `/login` | Magic-link + Google sign-in |
| `/auth/callback` | Exchanges OAuth/email code for a session |
| `/onboarding` | 7-step creator profile (formats, niche, category, goals, pillars, experience, tone) |
| `/library` | Inspo grid + Add Inspo flow |
| `/inspo/[id]` | Detail page with progressive enrichment |
| `/settings` | Profile snapshot |
| `/api/inspo` | `POST` save URL · `GET` list (with filters) |
| `/api/inspo/[id]` | `GET` detail · `DELETE` archive |
| `/api/inspo/[id]/retry-analysis` | `POST` retry ingestion |
| `/api/onboarding` | `POST` save creator profile |

## Phase 2 swap-ins

- Replace `StubCobaltProvider` with an HTTP client that calls your Cobalt fork (`COBALT_API_URL`)
- Replace `StubGeminiProvider` with the real Gemini multimodal call + Zod schema validation
- Replace inline `queueMicrotask` worker with Vercel Workflow / queue-based runner
- Wire metrics enrichment provider behind a similar interface

Nothing else has to change — the route handlers, UI, and database stay put.

## Spec

`inspome_v3_inspo_page_mvp_spec_with_onboarding.md` is the source of truth for product behavior and invariants. See `PERSONAS.md` for code-review lenses.
