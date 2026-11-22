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
| **F-04** | **Personal Member Dashboard & Empty Onboarding State** | Protected `/dashboard` route with responsive sidebar/mobile drawer + bottom nav, 4 telemetry cards, 5 Quick-Start Engine Launchers, filterable Projects Grid, and First-Time `0 Projects` Empty Onboarding state. | `04A/B`, `14A/B` | ⏳ Pending |
| **F-05** | **Step 1: AI Brainstorm & Create Video Wizard** | Real `/api/v1/ai/brainstorm` & `/api/v1/projects` creation flow: 5 AI concept cards, `30s/60s/90s`, `9:16`/`16:9`, 5 animation presets, Dual Voiceover toggle (`Edge Neural TTS` vs `ElevenLabs Pro`), and 2×2 voice audition. | `05A/B` | ⏳ Pending |
| **F-06** | **Steps 2 & 3: Interactive 60fps Storyboard & Animation Studio** | 3-column responsive studio (4-tab switcher on mobile/tablet), live 60fps HTML5 `<canvas>` programmatic renderer for all 5 engines, live scene script/node/subtitle editing, and multi-track timeline synced to DB. | `06A/B` | ⏳ Pending |
| **F-07** | **Step 4: On-Demand 1080p MP4 Render Pipeline & Failure Auto-Refund** | Real `/api/v1/projects/:id/render` endpoint invoking `packages/video-engine` + Edge Neural TTS + FFmpeg H.264, credit deduction, `0-Credits` non-destructive modal, and automatic credit refund on render failure. | `07A/B`, `14A/B` | ⏳ Pending |
| **F-08** | **Per-Member Instagram Connect OAuth 2.0 & Sandbox Publisher** | Isolated per-member Instagram OAuth vault (`AES-256-GCM` encrypted tokens), 3-step eligibility check, Personal Account / Expired Token error handling, Sandbox Mock Mode, and direct Reel publish + AI caption writer. | `07A/B`, `09A/B`, `14A/B` | ⏳ Pending |
| **F-09** | **Content Calendar & Automated Scheduled Reels Queue** | Full-screen 2×3 Scheduled Reels Grid + Active Queue Inspector drawer, schedule/reschedule/cancel/retry dispatch API, and background scheduler cron worker. | `08A/B` | ⏳ Pending |
| **F-10** | **Personal Brand Kit Studio** | Per-member brand colors, font stack, 4 word-synced subtitle presets, default voice & watermark safe-zone controls with live 9:16 preview stage persisted to DB. | `10A/B` | ⏳ Pending |
| **F-11** | **Video Credits Billing, Plan Tiers & Immutable Audit Ledger** | Real `credit_ledger` table, credit balance telemetry, plan tier cards, instant top-up simulation/Stripe hook, and CSV audit log export. | `11A/B` | ⏳ Pending |
| **F-12** | **Account Profile, Security Vault, Webhooks & API Keys** | Profile/timezone settings, TOTP 2FA & active device session revocation, Discord/Slack/email render webhooks, headless API key generation, and isolated workspace deletion. | `12A/B` | ⏳ Pending |

---

## 3. Feature Implementation Log (Proof of Work)

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
