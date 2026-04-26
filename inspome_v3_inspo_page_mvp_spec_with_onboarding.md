# Product Specification — InspoMe Inspo Intelligence MVP

## Overview

InspoMe is a mobile-first React application that helps creators and small business owners save, analyze, search, and learn from short-form social video inspiration.

The core experience is no longer:

> “What should I film today?”

The core experience is now:

> “Why does this saved video work, and what can I learn from it to make better content?”

The MVP should obsess over one thing: a really excellent Inspo experience.

Users paste TikTok or Instagram URLs, save them to an Inspo Library, and open an Inspo Detail Page that explains the content’s hook, structure, visuals, editing, transcript, platform metrics, performance hypothesis, and reusable creative patterns.

The product goal is to help users make better-performing content by understanding the content they already save, admire, and want to learn from.

This is not an ideas app in the MVP. Idea generation, daily recommendations, filming queues, completion tracking, and streaks are explicitly deprioritized.

---

## MVP Product Bet

Creators already save social content across Instagram and TikTok, but those saves are trapped inside platforms and hard to search, tag, compare, or learn from.

InspoMe becomes the user’s external brain for content inspiration:

- Save the content.
- Analyze why it works.
- Tag it automatically.
- Search and filter it later.
- Learn repeatable patterns from the best content.

The MVP wins if users say:

> “This is the best place to save and study content inspiration.”

Not:

> “This generated 30 mediocre ideas I didn’t ask for.”

Because apparently the internet did not have enough generic AI idea generators already.

---

## Product Invariants

These must never break:

1. Users can always save TikTok and Instagram inspiration links with minimal friction.
2. The Inspo Library must render saved links even if enrichment fails.
3. The Inspo Detail Page must gracefully show partial data instead of breaking.
4. Video analysis must never silently fail.
5. Auto-tagging must never silently fail.
6. Platform metrics must show source, freshness, and availability.
7. Cobalt must be isolated behind an ingestion abstraction, not hardcoded across the app.
8. Gemini analysis output must be schema-validated before persistence.
9. AI-generated metadata must map back to a saved `inspo_id`.
10. Ideas and recommendations must not distract from the core Inspo experience.

---

## Primary MVP Goal

Build a polished, mobile-first React app where users can:

1. Save TikTok and Instagram URLs.
2. See saved content in a beautiful Inspo Library.
3. Open a rich Inspo Detail Page.
4. Use Cobalt to download TikTok/Instagram media where possible.
5. Upload downloaded media to Gemini for deep video understanding.
6. Generate structured metadata for tagging, filtering, and search.
7. Pull platform metrics where available.
8. Understand why a video may have performed well.
9. Reuse creative patterns from saved content to improve their own content.

---

## Explicitly Deprioritized

The following should not be built in the MVP:

- Idea generation
- Daily recommendation engine
- “Film this today” flow
- Ideas queue
- Completion loop
- Mark as filmed / posted
- Streaks
- Content calendar
- Scheduling
- Auto-posting
- Collaboration
- Native mobile app

These can become Phase 2 or Phase 3 features after the Inspo intelligence layer is genuinely useful.

---

## Recommended Technical Direction

### Frontend

Use a mobile-first React web app.

Recommended stack:

- React
- Next.js or Vite
- Tailwind CSS
- Supabase Auth
- Supabase Postgres
- Supabase Storage
- Vercel
- PostHog

Do not start with React Native unless there is a hard requirement for native share sheet behavior on day one. A responsive React web app is faster to build, easier to iterate, and good enough to validate whether people actually care about this product before summoning the native-app demon.

### Backend

Recommended backend components:

- Next.js API routes or serverless functions
- Supabase Postgres
- Supabase Storage
- Background job queue
- Cobalt ingestion provider
- Gemini analysis service
- Metrics enrichment service
- Search/indexing layer

### AI Provider

Use Gemini for deep video analysis and structured metadata extraction.

Gemini should be used for:

- Video understanding
- Visual scene analysis
- Transcript/audio interpretation when available
- Hook detection
- Structure breakdown
- Editing/pacing analysis
- Viral/performance hypothesis
- Metadata/tag generation
- Searchable summaries

---

## Core User Experience

## 1. Authentication

### Goal

Get users into the app quickly.

### MVP Requirements

- Supabase Auth
- Magic link and Google login
- Minimal onboarding
- Redirect to Inspo Library after authentication

### Recommended MVP Onboarding

Keep onboarding lightweight, but keep the useful context from the previous spec because it helps Gemini analyze saved inspo through the user’s actual creator lens.

The onboarding goal is **not** to generate ideas. The onboarding goal is to personalize analysis, tagging, filtering, and performance interpretation.

The app should use onboarding answers to help answer:

> “Why does this content work for someone like me, in my niche, with my goals?”

Do not overbuild onboarding. The actual value comes from analyzing saved inspo, not interrogating users like they are applying for a creator visa.

### Onboarding Principles

- Keep onboarding under 60 seconds.
- Let users skip non-critical fields.
- Make all answers editable later in settings.
- Use onboarding context to personalize analysis, not to block usage.
- Do not require users to define content pillars before they have saved inspo.
- Do not ask about posting cadence in MVP unless it is moved to settings later.
- Show a lightweight progress indicator.
- After onboarding, send users directly to “Add your first inspo.”

### Step 1: Preferred Content Formats

Prompt:

> “What type of content do you prefer making?”

User can select up to 2.

Options:

- Talking to Camera
- Voiceover with Clips
- Clips with Text Overlays
- Filming IRL Moments / Conversations
- Aesthetic / Cinematic Visuals
- Skits / Acting / Characters
- Carousels
- Other

Stored as:

```ts
user.preferred_content[]
```

Use this to personalize the Inspo Detail Page.

Examples:

- If user prefers talking to camera, emphasize delivery, hook phrasing, speaking rhythm, facial expression, pacing, and authority.
- If user prefers aesthetic visuals, emphasize visual composition, scene choices, lighting, transitions, and mood.
- If user prefers voiceover with clips, emphasize script structure, b-roll sequencing, audio pacing, and visual-text alignment.

Do not say:

> “We’ll tailor ideas to this style.”

Say:

> “We’ll use this to analyze inspo through your content style.”

### Step 2: Content Niche

Prompt:

> “How would you describe your content?”

User can multi-select or add custom.

Options:

- Art
- Beauty
- Health & Wellness
- Business
- Comedy
- Education
- Events
- Fashion
- Finance & Investing
- Fitness
- Food
- Gaming
- Lifestyle
- Music
- News & Commentary
- Photography
- Sports
- Technology
- Travel
- Other

Stored as:

```ts
user.niche[]
```

Use this to:

- Improve tag relevance
- Interpret whether content patterns apply to the user’s niche
- Compare saved inspo by topic/category
- Personalize “why this worked” explanations

### Step 3: Creator Category

Prompt:

> “How would you best describe yourself?”

User single-selects or adds custom.

Options:

- Business Owner / Brand
- Content Creator / Personal Brand
- Artist / Musician
- Other

Stored as:

```ts
user.creator_category
```

Use this to change the framing of insights.

Examples:

- Business Owner / Brand: emphasize conversion intent, product positioning, trust-building, authority, and offer clarity.
- Content Creator / Personal Brand: emphasize audience growth, identity, personality, consistency, relatability, and recurring formats.
- Artist / Musician: emphasize aesthetic worldbuilding, taste, scene positioning, performance clips, emotional tone, and fan connection.

### Step 4: Content Goals

Prompt:

> “What are your content goals?”

User can multi-select or add custom.

Options:

- Grow Followers
- Promote My Brand / Art
- Drive Sales
- Go Viral
- Build Authority
- Improve Content Quality
- Stay Consistent
- Other

Stored as:

```ts
user.content_goals[]
```

Use this to personalize the performance hypothesis.

Examples:

- If goal is “Go Viral,” emphasize shareability, hook strength, novelty, trend fit, and retention loops.
- If goal is “Drive Sales,” emphasize product clarity, buyer pain point, credibility, CTA, and objection handling.
- If goal is “Build Authority,” emphasize expertise signals, specificity, proof, structure, and educational clarity.

Do not say:

> “We’ll optimize ideas for this.”

Say:

> “We’ll highlight content patterns that match your goals.”

### Step 5: Experience Level

Prompt:

> “How comfortable are you creating content?”

User selects one.

Options:

- Beginner — I struggle to post
- Intermediate — I post sometimes
- Advanced — I post consistently

Stored as:

```ts
user.experience_level
```

Use this to adjust the depth and tone of the Inspo Detail Page.

Examples:

- Beginner: simplify explanations, define creative terms, emphasize what is easy to copy or practice.
- Intermediate: show more tactical breakdowns around structure, pacing, and format adaptation.
- Advanced: include deeper analysis around retention, creative differentiation, platform fit, and performance tradeoffs.

### Optional Later Settings, Not MVP Onboarding

These fields are useful later, but should not block first use:

- Content pillars
- Tone
- Posting goals
- Brand voice
- Target audience
- Competitor accounts
- Preferred platforms
- Content formats the user wants to avoid

These can be added in Settings after the user has saved enough inspo for the app to make better suggestions. Do not shove all of this into onboarding like a SaaS onboarding form that was paid by the question.

### First-Time User Flow After Onboarding

Happy path:

1. User completes lightweight onboarding.
2. App routes user to Inspo Library.
3. Empty state prompts: “Add your first inspo.”
4. User pastes a TikTok or Instagram URL.
5. App asks optional “Why did you save this?”
6. App saves the inspo immediately.
7. App opens the Inspo Detail Page.
8. Backend starts Cobalt ingestion and Gemini analysis in the background.
9. Inspo Detail Page progressively populates as metadata, tags, metrics, and analysis become available.

The first-time flow should not generate ideas, recommend a filming task, or ask the user to commit to posting. The whole point is to get the user to their first “oh damn, this analysis is useful” moment as fast as possible.

### User Fields

```ts
user.creator_category
user.niche[]
user.content_goals[]
user.preferred_content[]
user.experience_level
user.onboarding_completed
user.onboarding_completed_at
user.created_at
user.updated_at
```

---

## 2. Inspo Library

### Purpose

The Inspo Library is the home screen and primary product surface.

It should feel like a fast, searchable, intelligent library of saved social content.

### User Actions

Users can:

- Add TikTok or Instagram URL
- Browse saved inspo
- Search saved inspo
- Filter by platform
- Filter by content format
- Filter by hook type
- Filter by topic
- Filter by visual style
- Filter by editing style
- Filter by performance level
- Open Inspo Detail Page
- Retry failed analysis
- Refresh metrics
- Archive/delete saved inspo

### Card Requirements

Each Inspo card should show:

- Thumbnail
- Platform badge
- Creator username, if available
- Caption preview, if available
- Save date
- Analysis status
- Metrics status
- View count, if available
- Like count, if available
- Comment count, if available
- Engagement rate, if available
- Top tags
- Save reasons

### Card States

Supported card states:

```ts
saved
queued_for_ingestion
downloading_media
media_downloaded
analyzing_with_gemini
analysis_complete
analysis_partial
metrics_available
metrics_partial
metrics_unavailable
failed
```

### Empty State

If the user has no inspo:

> “Save a TikTok or Instagram link to start building your content inspo library.”

CTA:

> “Add Inspo”

### Failed State

If a card has failed enrichment:

> “Saved, but analysis failed. Retry analysis.”

Do not hide failed cards. The saved link is still useful.

---

## 3. Add Inspo Flow

### Input Methods

MVP:

1. Paste URL

Phase 2:

1. Share to App
2. Browser extension
3. Bulk import

### Happy Path

1. User taps “Add Inspo.”
2. User pastes TikTok or Instagram URL.
3. System validates URL.
4. System creates `inspo` record immediately.
5. System stores original URL.
6. System normalizes platform.
7. System optionally asks “Why did you save this?”
8. User selects save reasons or skips.
9. User is taken to the Inspo Detail Page.
10. Background enrichment begins.

### Save First, Enrich Later

The app must save the link before attempting download, AI analysis, or metric enrichment.

The save flow should not depend on Cobalt, Gemini, TikTok APIs, Instagram APIs, scraping, or any external platform behaving like a decent citizen.

### Supported URLs

MVP supports:

- TikTok video URLs
- Instagram Reel URLs
- Instagram post URLs containing video

Future:

- Instagram carousel posts
- YouTube Shorts
- X/Twitter video posts
- Pinterest
- LinkedIn

### Save Reasons

Optional multi-select:

- Hook
- Editing style
- Storytelling
- Visual style
- Format / structure
- Trend
- Topic
- Delivery / personality
- Product angle
- High performance
- Relatability
- Aesthetic
- Other

Stored as:

```ts
inspo.save_reasons[]
```

### Constraints

- Empty input disables submit.
- Invalid URL shows visible error.
- Unsupported domain shows visible error.
- Valid URL should create an inspo record immediately.
- Duplicate URLs should be detected but not hard-blocked.
- User can save duplicate URLs if they choose.
- Save should never wait for video download.
- Save should never wait for AI analysis.
- Save should never wait for platform metrics.

---

## 4. Inspo Detail Page

## Purpose

This is the most important page in the product.

The Inspo Detail Page should help the user deeply understand:

- What the video is
- Why it likely performed well
- What hook it uses
- What structure it follows
- How it is edited
- What visual and audio patterns it uses
- What platform metrics say
- What tags describe it
- What reusable content pattern can be learned from it

This page is the product. Everything else supports this page.

---

## Inspo Detail Page Layout

### A. Media Header

Show:

- Thumbnail or embedded preview
- Platform badge
- Creator handle
- Original platform link
- Save date
- Analysis status
- Metrics status
- Retry analysis button
- Refresh metrics button
- Archive/delete menu

### B. Performance Snapshot

Show available metrics:

- Views
- Likes
- Comments
- Shares
- Saves/favorites, if available
- Reposts, if available
- Engagement rate
- Like rate
- Comment rate
- Share rate
- Posted date, if available
- Creator follower count, if available
- Last metrics refresh timestamp
- Metrics source
- Confidence level

### Metric Calculations

```ts
engagement_rate = (likes + comments + shares + saves) / views
like_rate = likes / views
comment_rate = comments / views
share_rate = shares / views
save_rate = saves / views
```

If views are missing, do not calculate rates that require views.

If a metric is unavailable, show:

> “Unavailable”

Not:

> “0”

Zero and unavailable are different. This should not need to be said, and yet dashboards everywhere continue committing crimes.

---

### C. AI Executive Summary

A concise summary of the content.

Fields:

```ts
analysis.summary
analysis.content_category
analysis.primary_topic
analysis.target_audience
analysis.why_user_may_have_saved_it
```

UI should answer:

- What is this video about?
- Who is it for?
- Why might it be interesting?
- What is the core takeaway?

---

### D. Why It Worked

This is the strategic insight section.

Fields:

```ts
analysis.why_it_worked.primary_reason
analysis.why_it_worked.secondary_reasons[]
analysis.why_it_worked.platform_fit
analysis.why_it_worked.audience_fit
analysis.why_it_worked.creative_strengths[]
analysis.why_it_worked.performance_risks[]
```

This section should explain:

- Why people might watch
- Why people might like
- Why people might comment
- Why people might share
- Why people might save
- Whether the content is strong because of hook, topic, timing, personality, editing, novelty, trend, controversy, utility, or aspiration

---

### E. Hook Analysis

Fields:

```ts
analysis.hook.text
analysis.hook.type
analysis.hook.modality
analysis.hook.timestamp_start
analysis.hook.timestamp_end
analysis.hook.strength_score
analysis.hook.notes
```

Hook types:

- Curiosity gap
- Pattern interrupt
- Contrarian take
- Direct promise
- Problem / solution
- Shock / surprise
- Relatable pain point
- Visual hook
- Status / aspiration
- Tutorial opener
- Transformation tease
- Conflict / tension

Hook modality:

- Spoken
- Text overlay
- Visual
- Audio/music
- Behavioral
- Mixed

UI should show:

- What happens in the first 1–3 seconds
- Why it grabs attention
- Whether the hook is strong, medium, or weak
- How the user could learn from the pattern

---

### F. Structure Breakdown

Fields:

```ts
analysis.structure.type
analysis.structure.beats[]
analysis.structure.pacing
analysis.structure.loopability
analysis.structure.retention_arc
```

Structure types:

- Listicle
- Tutorial
- Storytime
- Before / after
- Transformation
- Reaction
- Skit
- POV
- Montage
- Product demo
- Educational breakdown
- Hot take
- Trend remix
- Mini-documentary
- Day-in-the-life
- Case study

Beat schema:

```json
{
  "timestamp_start": 0,
  "timestamp_end": 3,
  "label": "Hook",
  "description": "Creator opens with a surprising claim.",
  "purpose": "Earn attention and create curiosity."
}
```

UI should present this as a simple timeline.

---

### G. Visual Analysis

Fields:

```ts
analysis.visuals.style
analysis.visuals.camera_framing
analysis.visuals.setting
analysis.visuals.lighting
analysis.visuals.motion
analysis.visuals.text_overlay
analysis.visuals.visual_density
analysis.visuals.notable_frames[]
```

Analyze:

- Camera angle
- Framing
- Lighting
- Setting/background
- Face-to-camera vs b-roll
- Motion and camera movement
- Text overlays
- Captions
- Color palette
- Visual novelty
- Visual clarity
- Visual retention devices

---

### H. Audio and Transcript Analysis

Fields:

```ts
analysis.audio.transcript
analysis.audio.speaking_style
analysis.audio.speaking_pace
analysis.audio.music_usage
analysis.audio.sound_effects
analysis.audio.caption_alignment
analysis.audio.key_phrases[]
```

Analyze:

- Spoken words
- Tone
- Delivery
- Speaking pace
- Music usage
- Sound effects
- CTA language
- Whether audio supports retention

If audio or transcript is unavailable, show:

> “Transcript unavailable. Visual analysis completed.”

---

### I. Editing Analysis

Fields:

```ts
analysis.editing.pace
analysis.editing.cut_frequency
analysis.editing.transitions[]
analysis.editing.caption_style
analysis.editing.retention_devices[]
analysis.editing.pattern_interrupts[]
```

Retention devices:

- Fast cuts
- Jump cuts
- Text reveals
- Zooms
- Sound effects
- Scene changes
- Visual contrast
- Open loop
- Countdown/list structure
- Cliffhanger ending
- Before/after reveal
- Comment bait
- Surprise payoff

---

### J. Metadata Tags

Gemini should generate tags that power filtering and search.

Tag groups:

```ts
analysis.tags.topics[]
analysis.tags.format[]
analysis.tags.hook_type[]
analysis.tags.structure_type[]
analysis.tags.visual_style[]
analysis.tags.editing_style[]
analysis.tags.tone[]
analysis.tags.content_pillar[]
analysis.tags.audience_intent[]
analysis.tags.performance_driver[]
```

Example tags:

```ts
talking_head
voiceover
cinematic_broll
hot_take
curiosity_gap
fast_cuts
educational
aspirational
relatable_pain_point
founder_content
music_promo
behind_the_scenes
transformation
trend_remix
```

### Tag Requirements

- Tags must be normalized.
- Tags must use controlled values where possible.
- Freeform tags are allowed only in a separate field.
- Tags must be persisted server-side.
- Filters must use persisted tags, not temporary client-side inference.

---

### K. Reusable Creative Pattern

This replaces MVP idea generation.

Instead of generating a new idea, the system extracts a reusable pattern from the saved inspo.

Fields:

```ts
analysis.reusable_pattern.name
analysis.reusable_pattern.template
analysis.reusable_pattern.when_to_use
analysis.reusable_pattern.why_it_works
analysis.reusable_pattern.adaptation_notes
```

Example:

```md
Pattern Name:
Contrarian Expert Breakdown

Template:
“Most people think [common belief], but actually [counterintuitive truth]. Here’s why…”

When to Use:
Use when challenging a common assumption in your niche.

Why It Works:
Creates tension, signals expertise, and gives viewers a reason to keep watching.
```

This teaches the user how to think, instead of vomiting “10 content ideas” like every AI tool built by someone who has never made content in their life.

---

## Video Ingestion Pipeline

## Goal

Use Cobalt to download TikTok and Instagram videos, then send the downloaded media to Gemini for deep analysis and metadata generation.

Repository:

```txt
https://github.com/Vinay-R/cobalt
```

## Architectural Rule

Do not call Cobalt directly from frontend code.

Cobalt should be integrated as a **backend-only media download provider**, not as a direct dependency of the React frontend and not as logic scattered throughout the main app codebase.

The React app should only communicate with InspoMe-owned backend APIs. The backend should delegate media download work to an ingestion abstraction:

```ts
content_ingestion_service
```

Cobalt should be one provider behind this service.

The correct architecture is:

```txt
Mobile-first React app
  → InspoMe backend API
  → content_ingestion_service
  → cobalt_provider
  → downloaded video/audio/thumbnail
  → Gemini analysis service
  → structured metadata saved to database
  → Inspo Detail Page updates
```

The incorrect architecture is:

```txt
React app
  → Cobalt directly
```

The other incorrect architecture is:

```txt
Main app codebase
  → Cobalt logic embedded everywhere
```

Why? Downloaders break. Platforms change. Repos drift. Social platforms enjoy moving the cheese and then charging developers rent to smell it. Cobalt is a dependency, not the product.

## Cobalt Deployment Model

For MVP, use the user-owned fork:

```txt
https://github.com/Vinay-R/cobalt
```

But run it as a **separate backend service** or hosted internal API.

Recommended options:

1. Deploy the Cobalt fork as its own service.
2. Expose an internal endpoint only the InspoMe backend can call.
3. Have the InspoMe backend call that internal Cobalt service from `cobalt_provider`.
4. Never expose the Cobalt service URL directly to the client.
5. Never let the frontend pass arbitrary provider options directly to Cobalt.

The backend owns:

- URL validation
- Rate limiting
- Auth/session validation
- User ownership checks
- Job creation
- Calling Cobalt
- Storing downloaded media or temporary files
- Sending media to Gemini
- Persisting analysis results
- Surfacing safe errors to the frontend

Cobalt owns only:

- Attempting to resolve/download media from a submitted TikTok or Instagram URL
- Returning media download results/errors to the backend

## Provider Abstraction Requirement

The product must treat Cobalt as a swappable provider.

Use an interface like:

```ts
interface ContentIngestionService {
  createIngestionJob(input: {
    inspoId: string;
    userId: string;
    url: string;
    platform: 'tiktok' | 'instagram';
  }): Promise<{
    jobId: string;
    status: 'queued';
  }>;
}
```

Then implement Cobalt behind a provider interface:

```ts
interface MediaDownloadProvider {
  canHandle(url: string): boolean;
  download(url: string): Promise<MediaDownloadResult>;
}
```

This allows future fallback providers without rewriting the Inspo page, database model, or Gemini analysis pipeline. If Cobalt breaks, the app should degrade gracefully instead of detonating like every “quick integration” ever shipped at 1:14 a.m.

---

## Ingestion Flow

1. User saves URL.
2. Create `inspo` record.
3. Create `ingestion_job`.
4. Backend calls `content_ingestion_service`.
5. Service attempts media download via Cobalt.
6. Store media temporarily or persistently depending on product/legal decision.
7. Extract basic media metadata:
   - duration
   - resolution
   - thumbnail
   - file size
   - audio availability
8. Upload media to Gemini.
9. Gemini returns structured analysis.
10. Validate response against schema.
11. Persist analysis and tags.
12. Update Inspo Detail Page.

---

## Ingestion Job Statuses

```ts
queued
downloading
downloaded
uploading_to_gemini
analyzing
analysis_complete
partial
failed
```

---

## Cobalt Provider Interface

```ts
interface MediaDownloadProvider {
  canHandle(url: string): boolean;

  download(url: string): Promise<{
    success: boolean;
    platform: 'tiktok' | 'instagram';
    sourceUrl: string;
    mediaFileUrl?: string;
    thumbnailUrl?: string;
    durationSeconds?: number;
    fileSizeBytes?: number;
    mimeType?: string;
    errorCode?: string;
    errorMessage?: string;
  }>;
}
```

---

## Ingestion Failure Handling

If Cobalt fails:

- Keep inspo saved.
- Mark `inspo.media_status = failed`.
- Keep original source URL.
- Attempt metadata-only enrichment if possible.
- Show visible error.
- Allow retry.
- Log failure reason.

User-facing message:

> “Saved, but we couldn’t download the video for analysis. Retry analysis.”

Do not show an empty page. Do not pretend analysis worked. Do not do the startup thing where “processing” means “we lost it.”

---

## Gemini Analysis Pipeline

## Goal

Use Gemini to deeply analyze downloaded TikTok/Instagram video content and return structured metadata.

Gemini should produce:

- Summary
- Hook analysis
- Structure breakdown
- Visual analysis
- Audio/transcript analysis
- Editing analysis
- Performance hypothesis
- Reusable creative pattern
- Normalized tags
- Searchable text summary

---

## Gemini Request Requirements

The backend should send:

- Video file
- Source URL
- Platform
- Caption, if available
- Creator handle, if available
- Platform metrics, if available
- User save reasons
- User niche/context, if available

The prompt should instruct Gemini to behave as:

> An expert short-form social video strategist analyzing why content performs well and extracting reusable creative patterns.

### Important Prompting Rules

- User-provided text must be isolated from system instructions.
- Captions and comments must be treated as untrusted input.
- Output must conform to JSON schema.
- Reject responses that do not match schema.
- Store model name and prompt version.

---

## Gemini Output Schema

```json
{
  "summary": "string",
  "content_category": "string",
  "primary_topic": "string",
  "target_audience": "string",
  "why_it_worked": {
    "primary_reason": "string",
    "secondary_reasons": ["string"],
    "platform_fit": "low | medium | high",
    "audience_fit": "low | medium | high",
    "creative_strengths": ["string"],
    "performance_risks": ["string"]
  },
  "hook": {
    "text": "string",
    "type": "string",
    "modality": "spoken | text_overlay | visual | audio | behavioral | mixed",
    "timestamp_start": 0,
    "timestamp_end": 3,
    "strength_score": 8,
    "notes": "string"
  },
  "structure": {
    "type": "string",
    "pacing": "slow | medium | fast",
    "loopability": "low | medium | high",
    "retention_arc": "string",
    "beats": [
      {
        "timestamp_start": 0,
        "timestamp_end": 3,
        "label": "Hook",
        "description": "string",
        "purpose": "string"
      }
    ]
  },
  "visuals": {
    "style": "string",
    "camera_framing": "string",
    "setting": "string",
    "lighting": "string",
    "motion": "string",
    "text_overlay": "string",
    "visual_density": "low | medium | high",
    "notable_frames": [
      {
        "timestamp": 0,
        "description": "string",
        "why_it_matters": "string"
      }
    ]
  },
  "audio": {
    "transcript": "string",
    "speaking_style": "string",
    "speaking_pace": "slow | medium | fast",
    "music_usage": "string",
    "sound_effects": "string",
    "caption_alignment": "string",
    "key_phrases": ["string"]
  },
  "editing": {
    "pace": "slow | medium | fast",
    "cut_frequency": "low | medium | high",
    "transitions": ["string"],
    "caption_style": "string",
    "retention_devices": ["string"],
    "pattern_interrupts": ["string"]
  },
  "reusable_pattern": {
    "name": "string",
    "template": "string",
    "when_to_use": "string",
    "why_it_works": "string",
    "adaptation_notes": "string"
  },
  "tags": {
    "topics": ["string"],
    "format": ["string"],
    "hook_type": ["string"],
    "structure_type": ["string"],
    "visual_style": ["string"],
    "editing_style": ["string"],
    "tone": ["string"],
    "content_pillar": ["string"],
    "audience_intent": ["string"],
    "performance_driver": ["string"]
  },
  "search_summary": "string"
}
```

---

## Platform Metrics Enrichment

## Goal

Pull in TikTok and Instagram metrics where available to enrich analysis.

Desired metrics:

```ts
views
likes
comments
shares
saves
favorites
reposts
engagement_rate
like_rate
comment_rate
share_rate
save_rate
posted_at
creator_follower_count
```

## Important Reality Check

Metric access is not guaranteed from arbitrary public URLs.

The product should treat social metrics as best-effort and source-labeled.

Possible sources:

1. Official APIs
2. Permissioned user connections
3. Approved research/developer APIs
4. Public embed metadata where legally/policy appropriate
5. Manual user input fallback

### Metrics Source Labels

```ts
official_api
permissioned_user_connection
research_api
embed_metadata
manual
unavailable
```

### Confidence Labels

```ts
high
medium
low
unknown
```

### Metrics UX Rule

Always show:

- Metric value
- Source
- Last fetched timestamp
- Confidence

Example:

> Views: 128,430  
> Source: TikTok API  
> Last updated: Apr 26, 2026  
> Confidence: High

---

## Search and Filtering

Search and filtering are core MVP features, not “nice to have.”

The user saves inspo specifically so they can find it again.

### Searchable Fields

Search should include:

- Caption
- Creator handle
- AI summary
- Transcript
- Hook text
- Topics
- Tags
- Save reasons
- Reusable pattern
- Performance hypothesis

### Filter Categories

Users should filter by:

- Platform
- Save reason
- Hook type
- Format
- Structure type
- Topic
- Visual style
- Editing style
- Tone
- Content pillar
- Performance driver
- Metrics availability
- Analysis status
- High-performing content

### Example Filters

- “TikToks with curiosity gap hooks”
- “Instagram Reels with fast cuts”
- “Music promo content”
- “Educational talking-head videos”
- “Videos saved for editing style”
- “High-shareability examples”

---

## Data Model

## User

```ts
users {
  id: uuid
  email: string
  creator_category: string | null
  niche: string[]
  content_goals: string[]
  preferred_content: string[]
  onboarding_completed: boolean
  timezone: string
  created_at: timestamp
  updated_at: timestamp
}
```

---

## Inspo

```ts
inspo {
  id: uuid
  user_id: uuid
  url_original: text
  url_canonical: text | null
  platform: 'tiktok' | 'instagram' | 'unknown'
  platform_content_id: text | null
  creator_handle: text | null
  caption: text | null
  thumbnail_url: text | null
  deep_link_url: text
  media_storage_url: text | null
  duration_seconds: number | null
  save_reasons: text[]
  note: text | null
  access_status: 'unknown' | 'accessible' | 'limited' | 'unavailable'
  media_status: 'not_started' | 'queued' | 'downloaded' | 'failed'
  analysis_status: 'not_started' | 'queued' | 'processing' | 'complete' | 'partial' | 'failed'
  metrics_status: 'not_started' | 'available' | 'partial' | 'unavailable' | 'failed'
  created_at: timestamp
  updated_at: timestamp
  last_analyzed_at: timestamp | null
  last_metrics_fetched_at: timestamp | null
  user_hidden: boolean
}
```

---

## Ingestion Jobs

```ts
ingestion_jobs {
  id: uuid
  user_id: uuid
  inspo_id: uuid
  provider: 'cobalt'
  status: 'queued' | 'downloading' | 'downloaded' | 'uploading_to_gemini' | 'analyzing' | 'complete' | 'partial' | 'failed'
  attempts: number
  error_code: text | null
  error_message: text | null
  started_at: timestamp | null
  completed_at: timestamp | null
  created_at: timestamp
}
```

---

## Video Analysis

```ts
video_analysis {
  id: uuid
  user_id: uuid
  inspo_id: uuid
  summary: text
  content_category: text | null
  primary_topic: text | null
  target_audience: text | null
  why_it_worked: jsonb
  hook: jsonb
  structure: jsonb
  visuals: jsonb
  audio: jsonb
  editing: jsonb
  reusable_pattern: jsonb
  tags: jsonb
  search_summary: text
  model_provider: 'gemini'
  model_name: text
  prompt_version: text
  schema_version: text
  created_at: timestamp
  updated_at: timestamp
}
```

---

## Platform Metrics

```ts
platform_metrics {
  id: uuid
  user_id: uuid
  inspo_id: uuid
  platform: 'tiktok' | 'instagram'
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  favorites: number | null
  reposts: number | null
  creator_follower_count: number | null
  posted_at: timestamp | null
  engagement_rate: number | null
  like_rate: number | null
  comment_rate: number | null
  share_rate: number | null
  save_rate: number | null
  source: 'official_api' | 'permissioned_user_connection' | 'research_api' | 'embed_metadata' | 'manual' | 'unavailable'
  confidence: 'high' | 'medium' | 'low' | 'unknown'
  fetched_at: timestamp
  created_at: timestamp
}
```

---

## Event Log

```ts
event_log {
  id: uuid
  user_id: uuid
  event_name: text
  entity_type: text
  entity_id: uuid
  properties: jsonb
  created_at: timestamp
}
```

---

## API Contracts

## Add Inspo

```http
POST /api/inspo
```

Request:

```json
{
  "url": "https://www.tiktok.com/...",
  "save_reasons": ["Hook", "Editing Style"]
}
```

Response:

```json
{
  "success": true,
  "data": {
    "inspo_id": "uuid",
    "platform": "tiktok",
    "created_at": "timestamp",
    "analysis_status": "queued"
  }
}
```

---

## Get Inspo Library

```http
GET /api/inspo
```

Query params:

```txt
platform
save_reason
hook_type
format
topic
analysis_status
metrics_status
search
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "inspo_id": "uuid",
      "platform": "tiktok",
      "thumbnail_url": "string",
      "creator_handle": "string",
      "caption": "string",
      "save_reasons": ["Hook"],
      "analysis_status": "complete",
      "metrics_status": "available",
      "metrics": {
        "views": 120000,
        "likes": 8400,
        "comments": 230,
        "engagement_rate": 0.072
      },
      "tags": ["curiosity_gap", "talking_head", "fast_cuts"],
      "created_at": "timestamp"
    }
  ]
}
```

---

## Get Inspo Detail

```http
GET /api/inspo/:id
```

Response:

```json
{
  "success": true,
  "data": {
    "inspo": {},
    "metrics": {},
    "analysis": {},
    "ingestion_job": {}
  }
}
```

---

## Retry Analysis

```http
POST /api/inspo/:id/retry-analysis
```

Response:

```json
{
  "success": true,
  "data": {
    "job_id": "uuid",
    "status": "queued"
  }
}
```

---

## Refresh Metrics

```http
POST /api/inspo/:id/refresh-metrics
```

Response:

```json
{
  "success": true,
  "data": {
    "metrics_status": "queued"
  }
}
```

---

## Archive Inspo

```http
POST /api/inspo/:id/archive
```

Response:

```json
{
  "success": true
}
```

---

## Rate Limits

Recommended MVP limits:

- Inspo creation: 60/hour/user
- Analysis requests: 20/day/user
- Retry analysis: 10/day/user
- Metrics refresh: 30/day/user
- General API: 60/min/user
- Magic link login: 5/email/hour

All rate-limit responses should include:

```ts
retry_after
error_code
message
```

---

## Security and Compliance Considerations

- Use Supabase Auth.
- Enforce RLS on all user-owned tables.
- Server derives `user_id` from authenticated session.
- Client never controls `user_id`.
- API keys must stay server-side.
- Validate and sanitize all URLs and free-text inputs.
- Treat captions, transcripts, comments, and platform metadata as untrusted.
- Use parameterized DB queries.
- Validate Gemini output against schema before storage.
- Store model version and prompt version.
- Avoid exposing raw provider errors to the client.
- Avoid storing external platform tokens in MVP unless needed.
- If tokens are added later, encrypt them at rest.
- Provide account deletion and data deletion path before public launch.
- Consider platform ToS and copyright constraints before storing downloaded media permanently.

---

## Event Tracking Plan

Track:

```ts
app_opened
inspo_added
inspo_save_failed
inspo_library_viewed
inspo_detail_viewed
original_link_opened
save_reason_added
search_used
filter_used
ingestion_started
ingestion_completed
ingestion_failed
gemini_analysis_started
gemini_analysis_completed
gemini_analysis_failed
metrics_refresh_started
metrics_refresh_completed
metrics_refresh_failed
analysis_retry_clicked
inspo_archived
```

---

Ideas for meta data tagging for data enrichment once the model has to create context for tagging:

- These 8 videos all use behind-the scenes, process video, fast subtitles, before/after structure, talking to camera, day in the life, and personal struggles/wins,

---

## Internal Evaluation Metrics

Primary MVP metrics:

- Inspo saves per active user
- Inspo detail page views per saved inspo
- Analysis completion rate
- Analysis failure rate
- Median analysis completion time
- Metrics availability rate
- Search usage rate
- Filter usage rate
- Retry rate after failed ingestion
- Week 1 retention after first successful analysis
- Cost per successful analysis

Do not use idea completion rate or recommendation acceptance rate as MVP success metrics. You are not building that product yet. Resisting scope creep is apparently the adult version of not eating crayons.

---

## Future Ideas Layer

Ideas are a future layer, not MVP.

Once the Inspo page is useful, future features can include:

- “Create my version of this”
- “Adapt this pattern to my niche”
- “Generate 3 hook variations from this inspo”
- “Turn this into a filming plan”
- “Batch content ideas from this collection”

But these should only be built after users repeatedly save, analyze, search, and revisit inspo.

The correct sequence is:

1. Save inspo.
2. Analyze inspo.
3. Search and filter inspo.
4. Learn patterns from inspo.
5. Only then generate ideas from inspo.

---

## Future Enhancements

### Share to App

Allow users to share TikTok/Instagram URLs directly into InspoMe from mobile share sheets.

### Collections

Let users group inspo into collections:

- Hooks
- Editing styles
- Music promo
- Founder content
- Product demos
- Competitors
- Viral references

### Comparison Mode

Let users compare multiple saved videos to identify common patterns.

Example:

> “These 8 videos all use curiosity-gap hooks, fast subtitles, and before/after structure.”

### Creator Analytics Layer

Later, if users connect their own TikTok/Instagram accounts, analyze their own content performance and compare it to saved inspo.

### Idea Generation

Generate ideas only after the app has enough saved and analyzed inspiration to make the output specific.

---

## Final Principle

InspoMe MVP is not a decision engine yet.

It is an inspiration intelligence system.

Every MVP feature must answer:

> “What makes this saved content work?”

Not:

> “What should the user film today?”

If the Inspo page is not excellent, nothing else matters.
