# Animora Studio — Project Status & Feature Tracker (Source of Truth)

> **Purpose:** This document is the single source of truth and proof of work for **Animora Studio**. Every time a feature is built, tested, and verified, its status, files, API endpoints, and verification results are logged here.
>
> **Design Reference:** Google Stitch Project `projects/8885471335130534594` (28 Screens: 14 Desktop + 14 Mobile, Design System `assets/1898333097011707571` — *Obsidian Cinema & Electric Vermilion*).

---

## 1. Completed Pre-Development Phases (Phases 1–3)

| Phase | Deliverable | Status | Reference |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Product Requirements Document (PRD) | ✅ Completed | `PRD.md` |
| **Phase 2** | Technical, System, API, DB & Brand Architecture | ✅ Completed | `TECHNICAL_DESIGN.md`, `SYSTEM_DESIGN.md`, `API_DESIGN.md`, `DB_DESIGN.md`, `BRAND_GUIDELINES.md` |
| **Phase 2B** | 60fps Programmatic Video Engine Prototype (5 Templates + Edge Neural TTS + 1080p MP4s) | ✅ Completed | `packages/video-engine/`, `solar-explainer-video.mp4`, `prototype-video.mp4` |
| **Phase 3** | Full 28-Screen Responsive UI/UX Suite in Google Stitch (14 Desktop + 14 Mobile, including Auth Errors, Recovery, Empty States, 0-Credits Modal, Render Refund & IG Errors) | ✅ Completed | Google Stitch `projects/8885471335130534594` |

---

## 2. Incremental Implementation Roadmap (One Feature at a Time)

| Feature ID | Feature Name | Scope (UI + Backend + Edge Cases) | Stitch Screens | Status |
| :--- | :--- | :--- | :--- | :--- |
| **F-01** | **App Scaffold, Design System & Shared Layout Shell** | Clean Next.js 15 + Tailwind CSS scaffold (`apps/web`), Obsidian Cinema & Electric Vermilion design tokens, Google Fonts (`Space Grotesk`, `Plus Jakarta Sans`, `JetBrains Mono`, `Material Symbols Outlined`), and SQLite WAL database foundation (7 tables). | Design System `assets/1898333097011707571` | ✅ Completed |
| **F-02** | **Public Marketing Homepage** | Fully responsive public homepage (Mobile, Tablet, Laptop, Desktop) matching Stitch `01A` & `01B` with interactive 9:16 solar flowchart preview, 5 animation engines showcase, pricing & CTAs. | `01A`, `01B` | ✅ Completed |
| **F-03** | **Real Multi-Tenant Auth, Password Reset & Email OTP** | Real salted password hashing, HttpOnly DB sessions, `user_id` tenant isolation, `+15 Free Starter Credits` ledger grant on signup, plus all error states (`401` wrong credentials, `409` duplicate email, `429` rate limit, password strength, forgot/reset password, 6-digit email OTP). | `02A/B`, `03A/B`, `13A/B` | ✅ Completed |
| **F-04** | **Personal Member Dashboard & Empty Onboarding State** | Protected `/dashboard` route with responsive sidebar/mobile drawer + bottom nav, 4 telemetry cards, 5 Quick-Start Engine Launchers, filterable Projects Grid, and First-Time `0 Projects` Empty Onboarding state. | `04A/B`, `14A/B` | ✅ Completed |
| **F-05** | **Step 1: AI Brainstorm & Create Video Wizard** | Real `/api/v1/ai/brainstorm` & `/api/v1/projects` creation flow: 5 AI concept cards, `30s/60s/90s`, `9:16`/`16:9`, 5 animation presets, Dual Voiceover toggle (`Edge Neural TTS` vs `ElevenLabs Pro`), and 2×2 voice audition. | `05A/B` | ✅ Completed |
| **F-06** | **Steps 2 & 3: Interactive 60fps Storyboard & Animation Studio** | 3-column responsive studio (4-tab switcher on mobile/tablet), live 60fps HTML5 `<canvas>` programmatic renderer for all 5 engines, live scene script/node/subtitle editing, and multi-track timeline synced to DB. | `06A/B` | ✅ Completed |
| **F-07** | **Step 4: On-Demand 1080p MP4 Render Pipeline & Failure Auto-Refund** | Real `/api/v1/projects/:id/render` endpoint invoking `packages/video-engine` + Edge Neural TTS + FFmpeg H.264, credit deduction, `0-Credits` non-destructive modal, and automatic credit refund on render failure. | `07A/B`, `14A/B` | ✅ Completed |
| **F-08** | **Per-Member Instagram Connect OAuth 2.0 & Sandbox Publisher** | Isolated per-member Instagram OAuth vault (`AES-256-GCM` encrypted tokens), 3-step eligibility check, Personal Account / Expired Token error handling, Sandbox Mock Mode, and direct Reel publish + AI caption writer. | `07A/B`, `09A/B`, `14A/B` | ✅ Completed |
| **F-09** | **Content Calendar & Automated Scheduled Reels Queue** | Full-screen 2×3 Scheduled Reels Grid + Active Queue Inspector drawer, schedule/reschedule/cancel/retry dispatch API, and background scheduler cron worker. | `08A/B` | ✅ Completed |
| **F-10** | **Personal Brand Kit Studio** | Per-member brand colors, font stack, 4 word-synced subtitle presets, default voice & watermark safe-zone controls with live 9:16 preview stage persisted to DB. | `10A/B` | ⏳ Pending |
| **F-11** | **Video Credits Billing, Plan Tiers & Immutable Audit Ledger** | Real `credit_ledger` table, credit balance telemetry, plan tier cards, instant top-up simulation/Stripe hook, and CSV audit log export. | `11A/B` | ⏳ Pending |
| **F-12** | **Account Profile, Security Vault, Webhooks & API Keys** | Profile/timezone settings, TOTP 2FA & active device session revocation, Discord/Slack/email render webhooks, headless API key generation, and isolated workspace deletion. | `12A/B` | ⏳ Pending |

---

## 3. Feature Implementation Log (Proof of Work)

### 2026-11-28 — Feature `F-09` Completed & Verified (Content Calendar & Automated Scheduled Reels Queue — `dev` branch)
- **Files Created / Updated:**
  - `apps/web/src/lib/schedule.ts` (Tenant-isolated scheduled Reels queue queries joined with `video_projects`, singleton 30-second background auto-dispatch cron worker + on-demand due-slot sweep, reschedule/caption edit, slot cancellation restoring project status, and `Force Instant Publish` / `Retry Dispatch` engine)
  - `apps/web/src/app/api/v1/schedule/route.ts`, `[id]/route.ts`, `[id]/dispatch/route.ts`, and `run-due/route.ts` (Authenticated `GET` list with status/month filters, `GET`/`PATCH`/`DELETE` single scheduled slot, `POST` instant/retry dispatch, and `POST` due-slot cron sweep)
  - `apps/web/src/components/ContentCalendarClient.tsx`, `apps/web/src/app/dashboard/calendar/page.tsx`, and `apps/web/src/components/RenderPublishClient.tsx` (Responsive Content Calendar matching Stitch `08A/B`: 3 view modes `Schedule Cards Grid` / `Weekly Timeline` / `Queue List`, status filter chips, sticky `Active Queue Inspector` with `<video>` preview & inline reschedule/caption editor, `Force Instant Publish to Instagram`, `Retry Dispatch`, and `+ Schedule New Reel` modal)
- **Verification Proof:**
  - `npm --prefix apps/web run typecheck` (`tsc --noEmit`): **0 errors**.
  - Live `F-09` API & Auto-Cron E2E Suite (`7/7` scenarios on `http://localhost:3010`): **Passed** (`401` auth guards across all 6 endpoints, multi-slot scheduling & filters, cross-tenant `404` isolation, `PATCH` reschedule/caption update, failed dispatch → `Retry Dispatch` → `published` recovery, automatic overdue cron sweep, and `DELETE` slot cancellation).
  - Live Browser QA (`5/5` checks on `http://localhost:3010/dashboard/calendar`, `0` console errors): **Passed** (Empty Queue State, `+ Schedule New Reel` modal, switching across `Schedule Cards Grid` / `Weekly Timeline` / `Queue List`, `Active Queue Inspector` `<video>` preview + caption save + `Force Instant Publish to Instagram`, and clean slot cancellation).
- **Next Active Task:** `F-10` — Personal Brand Kit Studio (`10A/B`).

### 2026-11-28 — Feature `F-08` Completed & Verified (Per-Member Instagram Connect OAuth 2.0 & Sandbox Publisher — `dev` branch)
- **Files Created / Updated:**
  - `apps/web/src/lib/instagram.ts` & `apps/web/src/lib/db.ts` (Real `AES-256-GCM` `96-bit IV` + `128-bit Auth Tag` token vault encryption/decryption; transparent legacy demo token upgrade; 3-step Meta Graph API v21.0 eligibility gates; `ERR_PERSONAL_TIER` guard; `TOKEN_DEGRADED` 60-day expiry detection & rotation; live handshake diagnostic probe; 4-tone AI Social Copywriter; and direct Reels container publish + calendar queue persistence)
  - `apps/web/src/lib/auth.ts` (Updated `getCurrentUser()` to validate `token_expires_at > now` so expired OAuth tokens accurately reflect degraded connection status)
  - `apps/web/src/app/api/v1/instagram/account/route.ts`, `connect/route.ts`, `refresh/route.ts`, `probe/route.ts`, `apps/web/src/app/api/v1/projects/[id]/generate-caption/route.ts`, and `apps/web/src/app/api/v1/publish/instagram/route.ts` (All 6 tenant-isolated Instagram Vault, Probe, AI Copywriter, and Direct Reels Publish / Schedule API routes)
  - `apps/web/src/components/InstagramConnectClient.tsx` & `apps/web/src/app/dashboard/integrations/page.tsx` (Responsive Instagram Connect & Meta Graph API Security Center matching Stitch `09A/B` & `14A/B` Panel 04)
  - `apps/web/src/components/RenderPublishClient.tsx` & `apps/web/src/app/dashboard/projects/[id]/publish/page.tsx` (Upgraded Step 4 Right Column matching Stitch `07A/B` with Target Creator Account card, 4-tone AI Social Copywriter, DOI Citation Auto-Comment toggle, Mode A `Publish Now` instant Reels dispatch, and Mode B `Schedule to Calendar`)
- **Verification Proof:**
  - `npm --prefix apps/web run typecheck` (`tsc --noEmit`): **0 errors**.
  - Live `F-08` API & Encryption E2E Suite (`7/7` scenarios on `http://localhost:3010`): **Passed** (`401` auth guards across all 7 endpoints, `ERR_PERSONAL_TIER` `400` guard, real `aes256gcm:` ciphertext verified in SQLite, `RENDER_REQUIRED` unrendered draft guard, 4-tone AI caption generation, `401 TOKEN_DEGRADED` expiry & 60-day token rotation, direct Reels publish + schedule queue + cross-tenant `404` isolation, and OAuth revocation).
  - Live Browser QA (`5/5` checks on `http://localhost:3010/dashboard/integrations`, `0` console errors): **Passed** (3/3 handshake gates, live diagnostic probe, `Simulate Expiry` → `TOKEN_DEGRADED` → 1-click re-authentication, and `ERR_PERSONAL_TIER` + 3-step Convert Account Guide).
- **Next Active Task:** `F-09` — Content Calendar & Automated Scheduled Reels Queue (`08A/B`).

### 2026-11-28 — Feature `F-07` Completed & Verified (Step 4: On-Demand 1080p MP4 Render Pipeline & Failure Auto-Refund — `dev` branch)
- **Files Created / Updated:**
  - `apps/web/src/lib/db.ts` & `apps/web/src/lib/render-engine.ts` (Added `renders` SQLite table; duration-tiered credit calculator `30s=1 / 60s=2 / 90s=3 CR`; atomic `BEGIN IMMEDIATE` credit deduction into `credit_ledger`; background headless Remotion + `msedge-tts` + FFmpeg H.264 MP4 worker; and idempotent `autoRefundFailedRender` restoring `+N CR` with `tx_ref_*_refunded` ledger proof on worker failure)
  - `packages/video-engine/scripts/synthesize-scenes.mjs`, `packages/video-engine/src/Root.tsx`, and `packages/video-engine/src/types/schema.ts` (Per-scene Edge Neural TTS MP3 synthesis with rate control, offline neural audio fallback, clean WebSocket teardown, and dynamic `30fps` / `60fps` metadata support)
  - `apps/web/src/app/api/v1/projects/[id]/render/route.ts`, `events/route.ts`, `video/route.ts`, `backup/route.ts`, and `apps/web/src/app/api/v1/credits/topup/route.ts` (Render job `POST`/`GET`, `402 INSUFFICIENT_CREDITS` guard, real-time `text/event-stream` SSE progress stream, authenticated HTTP `206` byte-range MP4 streaming & download, JSON script backup export, and 1-click credit top-up recovery)
  - `apps/web/src/components/RenderPublishClient.tsx`, `apps/web/src/app/dashboard/projects/[id]/publish/page.tsx`, and `apps/web/src/components/DashboardClient.tsx` (Full responsive Step 4 Render & Export screen matching Stitch `07A/B` + `14A/B` Zero-Credits Modal & Automatic Failure Refund diagnostic trace card)
- **Verification Proof:**
  - `npm --prefix apps/web run typecheck` (`tsc --noEmit`): **0 errors**.
  - Live `F-07` E2E Render & Auto-Refund Suite (`7/7` scenarios on `http://localhost:3010`): **Passed** (`401` auth guards across all 6 endpoints, cross-tenant `404` isolation, `0-Credits` `402` gate + `+25 CR` Top-Up recovery with zero data loss, simulated crash auto-refund `tx_ref_*_refunded` restoring wallet balance + JSON backup export, real `1080×1920` H.264 MP4 encode `1.7 MB` + SSE `event: progress` stream, and HTTP `206` byte-range MP4 playback with valid ISO BMFF `ftyp` header).
- **Next Active Task:** `F-08` — Per-Member Instagram Connect OAuth 2.0 & Sandbox Publisher (`07A/B`, `09A/B`, `14A/B`).

### 2026-11-26 — Feature `F-06` Completed & Verified (Steps 2 & 3: Interactive 60fps Storyboard & Animation Studio — `dev` branch)
- **Files Created / Updated:**
  - `apps/web/src/components/StudioCanvasPlayer.tsx` (High-DPI `1080×1920` / `1920×1080` 60fps HTML5 `<canvas>` `requestAnimationFrame` renderer supporting all 5 animation engines: `diagram_flow`, `kids_counting`, `split_comparison`, `stat_counter`, `illustrated_motion`; all 4 word-synced subtitle styles: `karaoke_highlight`, `hormozi_pop`, `kids_read_along`, `clean_minimal`; Reels/Shorts `96px` safe-zone guides; fullscreen; loop; and transport scrubbing)
  - `apps/web/src/components/StoryboardStudioClient.tsx` (Responsive 3-column desktop workstation matching Stitch `06A` + 4-tab mobile/tablet switcher matching Stitch `06B`: drag-and-drop & arrow scene deck reordering, `+ Add Scene`, `Delete Scene`, 3-tab Scene Inspector for Script & Voice / Diagram Props / Captions & Audio, Web Speech API narration audition, and interactive 4-track timeline sequencer dock)
  - `apps/web/src/app/api/v1/projects/[id]/route.ts` (Added `PATCH` endpoint for inline project title, `9:16` / `16:9` aspect ratio, `subtitleStyle`, `voiceId`, and `voiceSpeed` with proportional duration & word-timestamp rescaling)
  - `apps/web/src/app/api/v1/projects/[id]/scenes/route.ts`, `scenes/[sceneId]/route.ts`, `scenes/reorder/route.ts`, and `generate-assets/route.ts` (Tenant-isolated scene creation up to 20 scenes, template/props/narration/duration editing with automatic `word_timestamps` sync, `>=1` scene deletion guard, `1..N` deck reordering, and full-project voice/timestamp calibration)
  - `apps/web/src/app/dashboard/projects/[id]/studio/page.tsx` & `apps/web/src/app/dashboard/projects/[id]/publish/page.tsx` (Full Storyboard Studio route + Step 4 Render & Publish handoff route)
  - `apps/web/src/lib/ai-generator.ts` (Exported `truncateAtWord` & `sanitizeAnimationProps` for shared server-side scene sanitization)
- **Verification Proof:**
  - `npm --prefix apps/web run typecheck` (`tsc --noEmit`): **0 errors**.
  - Live `F-06` E2E API + SSR UI test suite (`8/8` scenarios on `http://localhost:3000`): **Passed** (`401` auth guards on all 6 `F-06` endpoints, `PATCH` project settings & `16:9` / `hormozi_pop` / `voiceSpeed` rescaling, `POST` add scene, `PUT` template & `animation_props` update, `POST` scene reorder `1..N`, `POST` `generate-assets` voice sync, cross-tenant `404` isolation, `DELETE` scene, and `200 OK` Studio + `/publish` SSR HTML & Tailwind CSS verification).
- **Next Active Task:** `F-07` — Step 4: On-Demand 1080p MP4 Render Pipeline & Failure Auto-Refund (`07A/B`, `14A/B`).

### 2026-11-26 — Feature `F-05` Completed & Verified (Step 1: AI Brainstorm & Create Video Wizard — `dev` branch)
- **Files Created / Updated:**
  - `apps/web/src/lib/ai-generator.ts` (3-tier AI chain: Gemini 2.5 Flash → Groq Llama 3.3 70B → Topic-Aware Deterministic Engine; dummy `.env.local` key guard; `VOICE_CATALOG` with 4 Edge Neural + 4 ElevenLabs Pro personas; and custom-script + brainstorm `SceneData[]` storyboard builder calibrated to speech speed)
  - `apps/web/src/app/api/v1/ai/brainstorm/route.ts` (Authenticated `POST` generating 5 structured hook-driven concepts)
  - `apps/web/src/app/api/v1/voices/route.ts` & `apps/web/src/app/api/v1/voices/audition/route.ts` (Voice catalog + real MP3 neural voice sample streaming)
  - `apps/web/src/app/api/v1/projects/route.ts` & `apps/web/src/app/api/v1/projects/[id]/route.ts` (`POST` storyboard creation with ElevenLabs → Edge Neural auto-fallback + `0 Credits` draft guarantee, and tenant-isolated `GET` single project)
  - `apps/web/src/lib/db.ts` & `apps/web/src/lib/projects.ts` (Added `voice_speed` migration column and `getUserProjectById` tenant query)
  - `apps/web/src/components/CreateVideoWizardClient.tsx` & `apps/web/src/app/dashboard/create/page.tsx` (Responsive Desktop `05A` + Mobile `05B` Create Video Wizard with 4-step stepper, AI Brainstorm vs. Custom Script tabs, `Ctrl+K` shortcut, 5 concept cards, `30s/60s/90s` & `9:16/16:9` pickers, 5 animation engines, Dual Voiceover toggle, live 2×2 MP3 voice audition, and `0.8x–1.3x` cadence slider)
  - `apps/web/src/app/dashboard/projects/[id]/studio/page.tsx` (Authenticated storyboard handoff screen displaying generated `SceneData[]` scenes)
- **Verification Proof:**
  - `npm --prefix apps/web run typecheck` (`tsc --noEmit`): **0 errors**.
  - `npm --prefix apps/web run build` (`next build`): **22/22 routes compiled & built cleanly**.
  - Live `F-05` E2E test suite (`7/7` scenarios + post-review hardening checks): **Passed** (default `animora-studio.sqlite` WAL startup & crash self-recovery, auth guards, Quick-Start query hydration, MP3 voice audition streaming, `Object.hasOwn` query guards, `voiceId` catalog validation, deep LLM `animation_props` sanitization, 8-scene storyboard creation at 0 credit cost, custom script splitting, and cross-tenant `404` isolation).
- **Next Active Task:** `F-06` — Steps 2 & 3: Interactive 60fps Storyboard & Animation Studio (`06A/B`).

### 2026-11-26 — Post-Review Hardening (`F-01`–`F-04` Audit Fixes — `dev` branch)
- **Fixes Applied & Verified:**
  - Untracked runtime SQLite WAL files (`apps/web/data/animora.sqlite*`) from Git index so local sessions never dirty Git status.
  - Added 5-attempt brute-force lockout (`429 OTP_LOCKED`) & timing-safe comparison to `/api/v1/auth/verify-otp`, blocked OTP resend for already-verified emails, and fixed inclusive 6-digit OTP range (`100000..999999`).
  - Wrapped multi-table signup provisioning (`users`, `brand_kits`, `credit_ledger`) and demo project seeding in atomic `BEGIN IMMEDIATE` SQLite transactions.
  - Unified `/api/v1/auth/forgot-password` response payload to prevent email enumeration and switched `/api/v1/auth/reset-password` to timing-safe token hash comparison.
  - Standardized `scenes_json` in `apps/web/src/lib/projects.ts` on the canonical `SceneData` contract from `packages/video-engine/src/types/schema.ts`, added `users.demo_seeded` so deleting all demo projects persists across refreshes, and made the sidebar credit bar plan-tier aware (`15` / `100` / `350`).

### 2026-11-22 — Feature `F-04` Completed & Verified (Personal Member Dashboard & First-Time Empty Onboarding — `dev` branch)
- **Code Review Hardening Applied (`ba47b0a`):** Added `apps/web/.env.example`, gated demo switcher in production, hardened HTTP `Range` video streaming (`416` validation + full stream), added OTP Backspace & 6-digit Paste support, and ignored `*.tsbuildinfo`.
- **Files Created / Updated:**
  - `apps/web/src/lib/projects.ts` (Tenant-isolated SQLite project queries, dashboard telemetry aggregation, and demo-only sample project seeding so brand-new users start with 0 projects)
  - `apps/web/src/app/api/v1/projects/route.ts` (Authenticated `GET` & tenant-scoped `DELETE` endpoints)
  - `apps/web/src/components/DashboardShell.tsx` (Responsive Obsidian Cinema shell: fixed `w-64` desktop sidebar, mobile/tablet slide-over drawer, top telemetry header, and fixed 5-tab mobile bottom nav bar)
  - `apps/web/src/components/DashboardClient.tsx` & `apps/web/src/app/dashboard/page.tsx` (4 Telemetry Cards, 5 Quick-Start Animation Engine Launchers, filterable Recent Video Projects Grid, and First-Time `0 Projects` Empty Onboarding checklist matching Stitch `04A/B` & `14A/B`)
- **Verification Proof:**
  - `npm --prefix apps/web run typecheck` (`tsc --noEmit`): **0 errors**.
- **Next Active Task:** `F-05` — Step 1: AI Brainstorm & Create Video Wizard (`05A/B`).

### 2026-11-22 — Feature `F-03` Completed & Verified (Real Multi-Tenant Auth, Password Reset & Email OTP — `dev` branch)
- **Files Created:**
  - `apps/web/src/lib/auth.ts` (`crypto.scryptSync` per-user salted password hashing, `timingSafeEqual` verification, 6-digit OTP generator, 14-day HttpOnly DB sessions, brute-force lockout after 5 attempts, and 3 idempotent demo creator tenants)
  - `apps/web/src/app/api/v1/auth/signup/route.ts` (Zod validation, 4-rule password strength check, `409 Conflict` duplicate email handling, `+15 Free Starter Credits` ledger entry, brand kit initialization, 6-digit OTP generation)
  - `apps/web/src/app/api/v1/auth/verify-otp/route.ts` (6-digit OTP verification + resend flow + HttpOnly session cookie creation)
  - `apps/web/src/app/api/v1/auth/login/route.ts` (Credential auth, `401` remaining-attempts counter, `429` 15-min brute-force lockout, `403` unverified email gate, and instant Demo Tenant Switcher)
  - `apps/web/src/app/api/v1/auth/forgot-password/route.ts` & `reset-password/route.ts` (15-min SHA-256 recovery token dispatch, password rotation, lockout reset, and old session revocation)
  - `apps/web/src/app/api/v1/auth/me/route.ts` & `logout/route.ts`
  - `apps/web/src/app/login/page.tsx`, `signup/page.tsx`, `forgot-password/page.tsx`, `dashboard/page.tsx`, and `components/LogoutButton.tsx`
- **Verification Proof:**
  - `npm --prefix apps/web run typecheck` (`tsc --noEmit`): **0 errors**.
  - `npm --prefix apps/web run build` (`next build`): **Compiled & built cleanly** (17/17 routes including all 7 `/api/v1/auth/*` endpoints, `/login`, `/signup`, `/forgot-password`, and protected `/dashboard`).
- **Next Active Task:** `F-04` — Personal Member Dashboard & First-Time Empty Onboarding State (`04A/B`, `14A/B`).

### 2026-11-22 — Feature `F-02` Completed & Verified (Public Marketing Homepage — `dev` branch)
- **Branch:** Created and switched to `dev` (`origin/dev`).
- **Files Created / Updated:**
  - `apps/web/src/components/HeroStudioPreview.tsx` (Interactive 3-pane 9:16 Solar Photovoltaic Studio preview with live scene switching & progress scrubber)
  - `apps/web/src/app/page.tsx` (Full responsive Public Marketing Homepage matching Stitch `01A` Desktop + `01B` Mobile: sticky navbar + mobile hamburger drawer, Hero, 4-step workflow, 5 Modular Animation Engines bento grid, Dual Voiceover & Captions, Per-Member Instagram Scheduler preview, 3-tier Pricing, Final CTA, Footer, and live 1080p MP4 Demo Modal)
  - `apps/web/src/app/api/v1/video-file/route.ts` (HTTP byte-range streaming endpoint for `solar-explainer-video.mp4` and `prototype-video.mp4`)
  - `.gitignore` (Ignored local SQLite database files in `apps/web/data/`)
- **Verification Proof:**
  - `npm --prefix apps/web run typecheck` (`tsc --noEmit`): **0 errors**.
  - `npm --prefix apps/web run build` (`next build`): **Compiled & built cleanly** (`/`, `/api/v1/health`, `/api/v1/video-file`).
- **Next Active Task:** `F-03` — Real Multi-Tenant Auth, Password Reset & Email OTP Verification (`02A/B`, `03A/B`, `13A/B`).

### 2026-11-22 — Feature `F-01` Completed & Verified (App Scaffold, Design Tokens & SQLite DB)
- **Files Created:**
  - `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.mjs`, `apps/web/postcss.config.mjs`, `apps/web/tailwind.config.ts`
  - `apps/web/src/app/globals.css`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`
  - `apps/web/src/lib/db.ts` (7-table multi-tenant SQLite WAL schema: `users`, `sessions`, `credit_ledger`, `brand_kits`, `social_accounts`, `video_projects`, `scheduled_posts`)
  - `apps/web/src/app/api/v1/health/route.ts` (Live DB healthcheck endpoint)
- **Verification Proof:**
  - `npm --prefix apps/web run typecheck` (`tsc --noEmit`): **0 errors**.
  - `npm --prefix apps/web run build` (`next build`): **Compiled & built cleanly** (`/`, `/_not-found`, `/api/v1/health`).
- **Next Active Task:** `F-02` — Public Marketing Homepage (`01A` Desktop + `01B` Mobile).
