# Phase 1 MVP Scaffold — Worklog

## Mission

Stand up the full InspoMe MVP shell — auth, onboarding, library, detail page, and the ingestion pipeline architecture — with stub providers so the UX can be exercised end-to-end before Cobalt and Gemini are wired.

## Architecture (one-liner)

```
React → Next.js routes → content_ingestion_service → MediaDownloadProvider → VideoAnalysisProvider → Supabase (RLS)
```

Cobalt and Gemini are **never** called from frontend code. Both live behind a swappable provider interface in `src/server/ingestion/`.

## What's built

- **Stack**: Next.js 16 (App Router, `proxy.ts`, Turbopack), React 19, Tailwind v4, Supabase (Auth + Postgres + Storage), shadcn-style local primitives, Zod
- **Auth**: magic link (token_hash flow) + Google OAuth, callback at `/auth/callback`
- **Onboarding**: 7 steps — formats, niche, category, goals, pillars, experience, tone (skippable). All stored to `public.users` with custom-text "Other" inputs
- **Library**: empty state, inline Add Inspo panel, card grid with live status, polls every 2.5s while enriching
- **Detail page**: progressive enrichment with all spec sections (Performance, Summary, Why It Worked, Hook, Structure timeline, Visuals, Audio, Editing, Tags, Reusable Pattern), retry/archive
- **Backend**: 6 tables + RLS, auto-create-profile trigger, stub providers personalize Gemini output via onboarding context

## Invariants (must hold)

- **INV-1:** Inspo row is created **before** any download/analysis attempt
- **INV-2:** Cobalt is only called from `src/server/ingestion/providers/`, never from UI
- **INV-3:** All user-owned tables enforce RLS (`auth.uid() = user_id`)
- **INV-4:** `user_id` is derived from session, never trusted from the client
- **INV-5:** Service-role key is server-only (`src/lib/supabase/admin.ts` uses `import "server-only"`)
- **INV-6:** Failed enrichment does NOT delete the saved link — partial state is the default

## Decisions

| Decision | Rationale |
|----------|-----------|
| Next.js 16 `proxy.ts` (not `middleware.ts`) | Renamed in Next 16; old name is deprecated |
| Tailwind v4 with OKLCH tokens | Better color science + native dark-mode pairing |
| Magic links via OTP `token_hash` (not PKCE) | UX win — survives different browsers; security delta is small for consumer app |
| Inline ingestion runner via `queueMicrotask` | Phase 1 doesn't need a real queue. Swappable for Workflow/queue in Phase 2 |
| `pillars[]` and `tone[]` added to schema upfront | They're INPUTS to Gemini personalization, not outputs. Cheap now, painful to backfill later |
| Lazy env access via getters with literal `process.env.X` reads | Dynamic `process.env[name]` access is NOT inlined in client bundles — silent failure |
| Polling (2.5s on library, 2s on detail) instead of realtime | Fewer moving parts in Phase 1. Switch to Supabase Realtime when streams matter |

## Surprises (gotchas captured)

- **Next.js 16 renamed `middleware.ts` → `proxy.ts`** with Node.js runtime by default. The matcher API and helper patterns are otherwise unchanged.
- **`process.env[dynamicKey]` does not inline** for `NEXT_PUBLIC_*` vars in the client bundle — must use literal property access or values are undefined in the browser.
- **PKCE magic links break across browsers/devices** because the code verifier is in a cookie on the original device. Token_hash flow avoids this entirely; the callback now handles both shapes.
- **`create-next-app` rejects capitalized directory names**. Scaffolded into `/tmp/inspome-scaffold` and rsynced into `InspoMe/`.

## Files of interest

- `src/proxy.ts` — Next 16 session-refresh entry point
- `src/lib/supabase/{browser,server,admin,session}.ts` — three Supabase clients, one for each context
- `src/lib/onboarding-options.ts` — single source of truth for onboarding option lists
- `src/server/ingestion/service.ts` — `InlineIngestionService` lifecycle (download → analyze → persist → status updates)
- `src/server/ingestion/providers/{stub-cobalt,stub-gemini}.ts` — Phase 1 stubs to swap in Phase 2
- `src/app/(app)/inspo/[id]/inspo-detail-view.tsx` — the heart of the product, every spec section
- `supabase/migrations/20260426000000_init_inspome_schema.sql` — applied to the live project

## Status

- ✅ `next build` clean (11 routes registered)
- ✅ Migration pushed to live Supabase project
- ✅ `npm run dev` runs without errors
- ⏳ Real magic-link sign-in pending email-template update by user (paste the token_hash template into Supabase dashboard)

## Phase 2 — what's next

1. Replace `StubCobaltProvider` with HTTP client → `Vinay-R/cobalt` fork (`COBALT_API_URL`)
2. Replace `StubGeminiProvider` with real Gemini multimodal call + Zod schema validation on output
3. Move ingestion runner from `queueMicrotask` to a real worker (Vercel Workflow / queue)
4. Metrics enrichment provider (TikTok/Instagram official APIs or embed metadata fallback)
5. Search & filter UI on the library (tags-driven, leveraging `video_analysis.search_summary` + the GIN index already in place)
6. Settings: editable onboarding fields
7. PostHog wiring for the event-tracking plan in the spec

## Session Log

### 2026-04-26 — Session 1 (this session)

**Goal:** Build the entire Phase 1 vertical slice from empty repo.

**Progress:**
- Scaffolded Next.js 16 + Tailwind v4
- Supabase clients (browser/server/admin) + `proxy.ts`
- Schema migration applied to live project (`vknrkzckgtgumsbyxriq`)
- 7-step onboarding (added `pillars`, `tone`, `creator_category_custom` per user request)
- Library + Add Inspo flow with optimistic update + polling
- Detail page with all spec sections
- Stub providers + ingestion service
- Fixed env-bundling bug (literal `process.env.X` for client)
- Switched magic links to token_hash flow for UX robustness

**Next session:**
- User to paste OTP email template, sign in, and walk the happy path
- Then: Phase 2 — wire real Cobalt + Gemini
