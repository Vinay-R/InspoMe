# CLAUDE.md

> **Project memory for Claude Code.** Auto-loaded at session start. Keep tight — link to deeper docs instead of inlining.

## What this is

**InspoMe** — npm-workspaces monorepo. `apps/web` is the Next.js 16 (App Router, Turbopack) app where creators save TikTok / Instagram videos and get AI-powered "why this works" analysis to learn reusable patterns. `apps/mobile` (Expo, in progress) is the iOS/Android client — its reason to exist is the iOS share sheet. `packages/` holds shared code (types, tokens) as it gets extracted.

- **Phase 1 (shipped 2026-04-26):** auth (Supabase magic link + Google OAuth), 7-step onboarding, library, detail page, ingestion service abstraction with stub providers.
- **Phase 2 (shipped 2026-04-28):** real Cobalt (IG) + Apify (TikTok) + Gemini multimodal analysis behind env-gated provider selection. `waitUntil` runner. Dark mode. End-to-end live in production.
- **Phase 3 (shipped 2026-04-30):** Upstash rate limit (10/hr on save+retry), prod-safe API error mapper, library search/filter, editable settings. PostHog wiring NOT done (still open).
- **Phase 4 (shipped 2026-05-04):** `/analytics` creator dashboard — stub providers + real Instagram OAuth (Meta dev-mode), AES-GCM token encryption, 2-tab bottom nav. See `worklogs/phase4-analytics.md`.
- **Phase 5 (in progress, started 2026-07-06):** 5A trust hardening (token exposure, stuck-job reaper, dedup, error hygiene, thumbnail persistence) → 5B funnel (landing, PWA share-target, skippable onboarding, actionable analysis) → 5C business (usage metering, Stripe freemium, digests). See `worklogs/phase5-consumer-readiness.md`.
- **Design v2 + monorepo + mobile scaffold (shipped 2026-07-07):** full visual reskin (Inter/Space Grotesk/Geist Mono, coral token system — from the "InspoMe App v2" Claude Design project); repo converted to npm workspaces (`apps/web`, `apps/mobile`, `packages/shared`); Expo SDK 57 app scaffolded (branded placeholder, `inspome://` scheme). Mobile next steps: auth → API bearer fallback → iOS share extension. See `worklogs/design-v2-reskin.md` + `worklogs/monorepo-and-mobile.md`.

## Architecture (one-paragraph mental model)

User saves a URL → Next.js route inserts an `inspo` row + `ingestion_job` row → fires `waitUntil(this.run(...))` → `RoutingDownloadProvider` dispatches by platform (TikTok → `ApifyTikTokProvider`, IG → `CobaltProvider`) → media URL → `GeminiProvider` analyzes (inline base64 ≤18MB, Files API >18MB) → Zod-validates structured output → upserts `video_analysis` row → updates inspo statuses. Detail page renders the analysis with progressive states (`queued → downloaded → processing → complete`). All credentials are server-only; user data lives behind Supabase RLS.

## Where to find what

- **Worklogs (gitignored):** `worklogs/phase*.md` — phase-by-phase decisions, gotchas, current state. **Read the latest worklog before any non-trivial change.**
- **Spec:** `inspome_v3_inspo_page_mvp_spec_with_onboarding.md` at repo root — UX + data model source of truth.
- **Cobalt docs (gitignored):** `cobalt_docs/` — local copies of Cobalt's protect-an-instance docs (note: v10-era; current is v11).
- **Ingestion code:** `apps/web/src/server/ingestion/` — providers, service, schema, types.
- **App code:** `apps/web/src/app/(app)/` — auth-gated app shell. `apps/web/src/app/auth/`, `.../login/`, `.../onboarding/` — pre-auth flows.
- **Supabase migrations:** `supabase/migrations/` (repo root — shared backend) — schema source of truth.
- **Server-only env getters:** `apps/web/src/lib/env.ts` — never read `process.env.*` directly outside this file.

## Conventions

- **TypeScript strict; no `any`.** Use `unknown` then narrow.
- **Zod at every external boundary** — Gemini output, route handler inputs.
- **Provider pattern:** new media platforms or model providers live behind `MediaDownloadProvider` / `VideoAnalysisProvider` interfaces. Selection by env presence in `service.ts`. Stub fallback for fresh clones.
- **`server-only` import** at the top of every server file that touches credentials.
- **No client-side fetches to credentialed APIs.** Server actions or route handlers only.
- **Status-machine writes** — `media_status`, `analysis_status`, `metrics_status`, `access_status` are independent state machines on the `inspo` row. Honest UX > fake states (use `unavailable` rather than fabricating data).
- **Caption-injection defense** — untrusted user content goes in delimited blocks (`<<<CAPTION>>>` etc.) inside the user turn; trusted persona in `systemInstruction`. Never feed raw caption text into a system prompt.
- **`waitUntil` for fire-and-forget** — never `queueMicrotask` for work that crosses the response boundary; the function will die mid-flight on cold-start.

## Required env (server-only unless noted)

Public (browser-readable):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Server-only:
- `SUPABASE_SERVICE_ROLE_KEY` — admin client; backend writes only.
- `GEMINI_API_KEY` — Google AI Studio. Falls back to stub if absent.
- `COBALT_API_URL` (must include `https://` scheme!), `COBALT_API_KEY` — Instagram downloads. Stub fallback.
- `APIFY_API_TOKEN` — TikTok via Apify. Stub fallback.
- `APIFY_TIKTOK_ACTOR` (optional) — defaults to `clockworks/tiktok-scraper`.

`.env.example` has the full list with comments.

## Common gotchas (full list in worklog)

- `COBALT_API_URL` must include `https://` — Node's `fetch` throws `ERR_INVALID_URL` on schemeless input.
- Apify KV-store URLs are private — `gemini.ts:fetchVideoBytes` adds the bearer token only for `apify.com` hostnames.
- `clockworks/tiktok-scraper` requires `shouldDownloadVideos: true` to populate `mediaUrls`; otherwise the response is empty of video URLs.
- Gemini's `safetySettings` requires the `HarmCategory` / `HarmBlockThreshold` enums (not raw strings) — TS-only check.
- Mobile email apps (Gmail/Outlook iOS) open links in their in-app browser; magic links require "long-press → Open in Safari".

## Operating

- **All commands run from repo root** (npm workspaces delegate to `apps/web`): `npm run dev` (Turbopack, port 3000; tail `/tmp/inspome-dev.log` if backgrounded), `npm run build`, `npm run lint`, `npm run typecheck`. Existing `<img>` lint warnings are accepted; flag any new ones in review.
- **Single lockfile at repo root** — never create per-workspace lockfiles.
- **Prod URL:** https://inspo-me.vercel.app — auto-deploys from `main` (Vercel Root Directory = `apps/web`). Verify deploy with `gh api repos/Vinay-R/InspoMe/deployments --jq '.[0]'`.

## Project preferences

- **Pacing:** charge through aligned sub-tasks; check in at phase boundaries, not per file.
- **Commits:** new commits over amends. End-of-phase batched commit acceptable; never commit secrets — `.env.local` is gitignored, double-check before staging.
- **No premature abstractions** — three similar lines beats a wrong abstraction.
- **Comments only when WHY is non-obvious** — let names carry the WHAT.
