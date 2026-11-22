# Technical Design Document (TDD): Animora Studio
**Product Name:** Animora Studio — AI Educational & Animated Video SaaS Platform  
**SDLC Phase:** Phase 2 — High-Level Design (HLD) & Low-Level Design (LLD)  
**Related PRD:** [PRD.md](file:///c:/Users/rk751/Projects/AI%20Video/PRD.md)  
**Tech Stack:** Next.js (TypeScript + Tailwind + Framer Motion) • Remotion (React/SVG Animation Engine) • Go (Golang 1.23+ API & Goroutine Workers) • PostgreSQL (`GORM`) • Free-Tier AI & Cloud Stack

---

## 1. High-Level Design (HLD) & Core Architectural Principles

### 1.0 Quick-Reference Technical Summary: AI Models, Ingest Queue & Running Pipeline

To give a clear at-a-glance overview of how **Animora Studio** operates under the hood, here is the exact summary of **(A) Which AI models power each step of the video explainer** and **(B) What powers the ingest, queue, and running execution pipeline**:

#### A. Summary of AI Models & Engines Used for the Video Explainer

| Explainer Stage | Primary AI Model / Engine | Fallback / Secondary Engine | Exact Role in the Pipeline |
| :--- | :--- | :--- | :--- |
| **1. Topic Brainstorming & Hooks** | **Google Gemini 2.5 Flash** (`gemini-2.5-flash`) | **Groq** (`llama-3.3-70b-versatile`) | Generates 5 hook-driven educational or kids-learning video ideas from a user's niche or topic. |
| **2. Timed Script & Scene Storyboard JSON** | **Google Gemini 2.5 Flash** (with strict `ResponseSchema`) | **Groq** (`llama-3.3-70b-versatile` JSON mode) | Writes the 30s/60s/90s voiceover script, splits it into 6–15 scenes, and outputs validated JSON for the 5 animation templates. |
| **3. Voiceover Audio & Word Timestamps** | **Microsoft Edge Neural TTS** (Default Free Unlimited) *or* **ElevenLabs** (`eleven_flash_v2_5` via UI toggle) | **Automatic Fallback to Edge Neural TTS** (if ElevenLabs quota/IP limits hit) | Synthesizes `.mp3` voiceover per scene (*Kids voice `AnaNeural`*, *Explainer `ChristopherNeural` / `AriaNeural` / `NeerjaNeural`*) + millisecond `{ word, start_ms, end_ms }` timestamps. |
| **4. Educational Diagrams, Kids A-Z/Counting & Subtitles** | **Remotion (`@remotion/core`) + React SVG & Spring Physics** | Deterministic code execution (never fails) | Animates flowcharts, A-to-Z letters, 1-to-20 counting objects popping in on beat, comparison cards, stat charts, and 4 word-synced subtitle styles at 60fps. |
| **5. Scene Illustrations & Stickers** | **Pollinations.ai (`Flux` Model)** | **Cloudflare Workers AI** (`flux-1-schnell`) / Built-in SVG Art | Generates custom `9:16` or `16:9` illustrations in *Flat Vector*, *3D Pixar Storybook*, *Whiteboard*, or *Dark Tech* styles. |
| **6. Instagram Reel Caption & Hashtags** | **Google Gemini 2.5 Flash** | **Groq** (`llama-3.3-70b-versatile`) | Writes the Instagram Reel social post copy (scroll-stopping hook + bullet summary + CTA + 10 targeted hashtags). |

#### B. Summary of Ingest, Queue & Running Pipeline Infrastructure

| Pipeline Stage | Technology Used | Why We Use It (Instead of Heavy External Brokers) |
| :--- | :--- | :--- |
| **1. API Ingest & Multi-Tenant Gatekeeper** | **Go (Golang 1.23+) + `Chi` Router + JWT `AuthMiddleware`** | Validates every incoming request, extracts `user_id` from the JWT, and persists job state in PostgreSQL via **`GORM`** (~25MB RAM footprint). |
| **2. Parallel Asset Generation Pipeline** | **Go Goroutines + `errgroup` Bounded Worker Pool (4 parallel workers)** | Replaces complex external Node/BullMQ workers for asset creation—Go fans out concurrent goroutines to generate all 6–15 scene voiceovers, timestamps, and images simultaneously in ~2–3 seconds. |
| **3. Real-Time Pipeline Progress Stream** | **Go Server-Sent Events (SSE) Pub/Sub Broker (`GET /projects/:id/events`)** | Streams live `0% ➔ 100%` scene asset and MP4 rendering progress directly to the Next.js Studio UI over a lightweight HTTP stream. |
| **4. Live Video Preview vs. Final MP4 Export Pipeline** | • **Preview:** **`@remotion/player`** (Client-side in Next.js browser)<br>• **Final Export:** **Go Render Runner $\rightarrow$ Headless Remotion (`@remotion/renderer` + Chromium + `FFmpeg`)** | • Browser preview runs at 60fps on the user's device for **$0 server CPU**.<br>• Final export encodes the 1080p H.264 `.mp4` (`9:16` or `16:9`) and uploads it to **Supabase Storage / Cloudflare R2**. |
| **5. Scheduled Instagram Publishing Queue & Cron Pipeline** | **PostgreSQL Persistent Queue (`scheduled_posts`) + Go 60-Second Cron Ticker (`FOR UPDATE SKIP LOCKED`)** | Crash-safe, zero-cost replacement for Redis/BullMQ/Inngest. Every 60s, Go claims due scheduled Reels from PostgreSQL, runs the 2-step **Meta Instagram Graph API v21.0** container + publish pipeline, and auto-retries up to 3 times on failure. |

---

### 1.1 Architectural Design Principles
1. **Strict Per-Member Multi-Tenancy:** Every table in PostgreSQL is owned by a specific `user_id`. Every Go API endpoint enforces tenant isolation via JWT middleware (`WHERE user_id = currentUserID`). No dashboard, project, render, or Instagram account is ever shared across members.
2. **Hybrid Relational + Typed `JSONB` Extensibility:** Common relational fields (`id`, `user_id`, `project_id`, `order_index`, `scene_type`, `duration_ms`) are standard indexed PostgreSQL columns managed by Go `GORM`. Template-specific animation properties (`animation_props`) are validated against compile-time Go `struct`s and stored as binary-indexed PostgreSQL `JSONB`. This allows adding new animation templates in V2/V3 with **zero database schema migrations**.
3. **Zero-Cost 60fps Browser Preview vs. On-Demand Server MP4 Export:**
   * While a member edits their script, diagrams, counting objects, or captions in the Studio (Page 6), the video is rendered **client-side at 60fps** using `@remotion/player` in Next.js (**$0 server CPU cost**).
   * Server-side headless MP4 rendering only runs when the member clicks **"Render Final MP4"**.
4. **Resilient Dual-Provider AI with Automatic Fallbacks:**
   * **LLM:** Google Gemini 2.5 Flash (primary, with native `ResponseSchema`) $\rightarrow$ automatically falls back to Groq (`llama-3.3-70b-versatile`) on rate-limit/timeout.
   * **Voiceover (TTS):** ElevenLabs (`/with-timestamps`) $\leftrightarrow$ Free Microsoft Edge Neural TTS (`WordBoundary`), with a UI toggle and automatic fallback to Free Edge Neural TTS if ElevenLabs hits its free 10,000-character monthly quota or cloud IP block.

---

### 1.2 High-Level System Architecture Diagram

```mermaid
flowchart TD
    subgraph Client["Client Layer: Next.js 15 App Router (TypeScript + Framer Motion)"]
        Pages["10 SaaS Pages (Auth, Dashboard, Wizard, Studio, Publish, Calendar)"]
        RemotionPlayer["Embedded 60fps @remotion/player (Live 9:16 & 16:9 Preview)"]
        SSEClient["EventSource (Real-Time Asset & Render Progress)"]
    end

    subgraph SharedEngine["Shared Package: packages/video-engine (TypeScript + Remotion)"]
        Comp["MasterVideoComposition (9:16 Vertical & 16:9 Landscape)"]
        Templates["5 Animated Scene Components\n(KidsCounting, DiagramFlow, SplitComparison, StatCounter, IllustratedMotion)"]
        Subtitles["4 Word-Synced Subtitle Overlays\n(Karaoke, Hormozi, KidsReadAlong, CleanMinimal)"]
    end

    subgraph GoBackend["Backend Layer: Go (Golang 1.23+) API & Worker Engine"]
        Router["Chi HTTP Router + CORS + Rate Limiter"]
        AuthMW["JWT Tenant Middleware (Strict user_id Isolation)"]
        Handlers["REST Controllers + SSE Stream Broker"]
        Orch["Parallel Goroutine Asset Orchestrator (errgroup)"]
        Cron["60-Second Postgres Cron Scheduler (FOR UPDATE SKIP LOCKED)"]
        Crypto["AES-256-GCM Token Encryptor"]
    end

    subgraph Providers["External AI, Storage & Social Providers (Free-Tier Stack)"]
        PG[("PostgreSQL (Supabase / Neon)\nManaged via Native Go GORM")]
        Store[("Public Object Storage\n(Supabase Storage / R2 / Local Dev)")]
        LLM["LLM Service\n(Gemini 2.5 Flash + Groq Llama 3.3)"]
        TTS["Dual TTS Service\n(ElevenLabs + Free Edge Neural TTS)"]
        IMG["Illustration Service\n(Pollinations Flux Free API)"]
        IG["Meta Instagram Graph API v21.0\n(OAuth 2.0 + Reels Container Publisher)"]
    end

    Pages --> RemotionPlayer
    RemotionPlayer --> Comp
    Comp --> Templates
    Comp --> Subtitles

    Pages <-->|"HTTPS REST JSON (JWT Cookie)"| Router
    SSEClient <-->|"GET /api/v1/projects/:id/events (text/event-stream)"| Handlers
    Router --> AuthMW --> Handlers
    Handlers --> PG
    Handlers --> Orch
    Orch -->|"Structured JSON Schema"| LLM
    Orch -->|"Parallel Goroutines"| TTS
    Orch -->|"Parallel Goroutines"| IMG
    Orch -->|"Upload MP3 / PNG / MP4"| Store
    Orch -->|"Headless Render CLI"| Comp
    Cron --> PG
    Cron --> Crypto
    Cron -->|"1. Create Container\n2. Poll FINISHED\n3. Publish Reel"| IG
    IG <-->|"Fetches Public HTTPS .mp4"| Store
```

---

## 2. Low-Level Design (LLD): Monorepo Folder & Package Structure

We use a clean monorepo separating the **Go Backend (`apps/api`)**, the **Next.js Frontend (`apps/web`)**, and the **Shared Remotion Animation Engine (`packages/video-engine`)**:

```text
animora-studio/
├── PRD.md                                  # Phase 1: Product Requirements Document
├── TECHNICAL_DESIGN.md                     # Phase 2: Technical Design Document (This file)
├── package.json                            # Workspace scripts (dev, build, render)
├── .env.example                            # Documented environment variables
│
├── packages/
│   └── video-engine/                       # Shared Remotion Video & Animation Package
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
│           ├── index.ts                    # Entrypoint & exports for Next.js + CLI Renderer
│           ├── Root.tsx                    # Remotion <Composition /> definitions (9:16 & 16:9)
│           ├── types/
│           │   └── schema.ts               # Shared TypeScript interfaces matching Go structs
│           ├── compositions/
│           │   └── AnimoraVideo.tsx        # Master timeline sequencer + audio ducking mixer
│           ├── templates/
│           │   ├── KidsCountingScene.tsx   # Template 1: Kids A-Z & 1-20 Counting Animation
│           │   ├── DiagramFlowScene.tsx    # Template 2: Step-by-Step Animated Flowchart
│           │   ├── SplitComparisonScene.tsx# Template 3: Myth vs. Fact / Pros vs. Cons Cards
│           │   ├── StatCounterScene.tsx    # Template 4: Animated Number Ticker & Bar Chart
│           │   └── IllustratedMotionScene.tsx # Template 5: AI Art + Ken Burns + Callout Pill
│           └── subtitles/
│               └── SubtitleOverlay.tsx     # 4 Word-Synced Caption Styles (Karaoke, Hormozi, Kids, Minimal)
│
├── apps/
│   ├── api/                                # Go (Golang 1.23+) Backend API & Background Workers
│   │   ├── go.mod
│   │   ├── go.sum
│   │   ├── cmd/
│   │   │   └── server/
│   │   │       └── main.go                 # Boots DB, AutoMigrate, Cron Worker, and HTTP Server
│   │   └── internal/
│   │       ├── config/
│   │       │   └── config.go               # Loads & validates env vars
│   │       ├── database/
│   │       │   └── postgres.go             # GORM connection pool & AutoMigrate execution
│   │       ├── models/
│   │       │   ├── models.go               # GORM database structs (User, Project, Scene, etc.)
│   │       │   └── animation_props.go      # Go structs for the 5 scene animation_props JSONB
│   │       ├── middleware/
│   │       │   ├── auth.go                 # JWT verification & tenant context injection
│   │       │   └── cors.go                 # CORS & security headers
│   │       ├── handlers/
│   │       │   ├── auth_handler.go         # Register, Login, Logout, Me, BrandKit
│   │       │   ├── project_handler.go      # Brainstorm, Project CRUD, Scene CRUD & Reorder
│   │       │   ├── pipeline_handler.go     # Generate Assets, Single-Scene Re-roll, Render, SSE
│   │       │   └── instagram_handler.go    # IG OAuth, Sandbox Mock, Caption AI, Publish & Calendar
│   │       ├── services/
│   │       │   ├── llm/
│   │       │   │   ├── provider.go         # LLM interface + duration calibration formulas
│   │       │   │   ├── gemini.go           # Gemini 2.5 Flash structured JSON schema client
│   │       │   │   └── groq.go             # Groq Llama 3.3 70B client & automatic fallback
│   │       │   ├── tts/
│   │       │   │   ├── provider.go         # TTSOrchestrator with automatic fallback
│   │       │   │   ├── edge_tts.go         # 100% Free Edge Neural TTS + WordBoundary parser
│   │       │   │   └── elevenlabs.go       # ElevenLabs /with-timestamps client + word aligner
│   │       │   ├── image/
│   │       │   │   └── pollinations.go     # Free Pollinations Flux illustration URL/fetcher
│   │       │   ├── storage/
│   │       │   │   └── storage.go          # Supabase Storage / R2 / Local public static uploader
│   │       │   ├── render/
│   │       │   │   └── remotion_runner.go  # Invokes Remotion headless MP4 render & streams progress
│   │       │   └── instagram/
│   │       │       ├── crypto.go           # AES-256-GCM encryption for per-user OAuth tokens
│   │       │       └── graph_api.go        # Meta OAuth 2.0, Container Creation, Polling & Publish
│   │       └── worker/
│   │           ├── sse_broker.go           # Pub/Sub broker for per-project SSE progress events
│   │           └── scheduler.go            # 60-second Cron ticker for due scheduled Instagram Reels
│   │
│   └── web/                                # Next.js 15 Frontend (TypeScript + Tailwind + Framer Motion)
│       ├── package.json
│       ├── next.config.ts
│       └── src/
│           ├── app/
│           │   ├── page.tsx                # Page 1: Public Landing Page
│           │   ├── signup/page.tsx         # Page 2: Member Sign Up Page
│           │   ├── login/page.tsx          # Page 3: Member Login Page
│           │   └── dashboard/
│           │       ├── layout.tsx          # Protected Member Sidebar & Top Header Bar
│           │       ├── page.tsx            # Page 4: Personal Member Dashboard
│           │       ├── create/page.tsx     # Page 5: Step 1 — AI Brainstorm & Format Wizard
│           │       ├── projects/[id]/
│           │       │   ├── studio/page.tsx # Page 6: Step 2 & 3 — Interactive Storyboard Studio
│           │       │   └── publish/page.tsx# Page 7: Step 4 — Render Export & IG Publish Studio
│           │       ├── calendar/page.tsx   # Page 8: Content Calendar & Scheduled Posts
│           │       ├── integrations/page.tsx # Page 9: Per-Member Instagram Connect
│           │       └── settings/page.tsx   # Page 10: Brand Kit, Credits & Account Settings
│           ├── components/
│           │   ├── studio/                 # Storyboard timeline, Remotion Player wrapper, 3-Tab Inspector
│           │   ├── calendar/               # Monthly/Weekly calendar grid & reschedule modal
│           │   └── ui/                     # Reusable buttons, modals, badges, toasts
│           └── lib/
│               ├── api.ts                  # Typed fetch wrapper for Go backend API
│               └── auth-context.tsx        # Member session state & protected route guard
```

---

## 3. Database Design & Native Go `GORM` Models

### 3.1 Entity-Relationship Diagram (PostgreSQL)

```mermaid
erDiagram
    USERS ||--o| BRAND_KITS : "1:1 user_id"
    USERS ||--o{ PROJECTS : "1:N user_id"
    USERS ||--o{ INSTAGRAM_ACCOUNTS : "1:1 user_id"
    USERS ||--o{ CREDIT_LEDGER : "1:N user_id"
    PROJECTS ||--|{ SCENES : "1:N project_id"
    PROJECTS ||--o{ RENDERS : "1:N project_id"
    RENDERS ||--o{ SCHEDULED_POSTS : "1:N render_id"
    INSTAGRAM_ACCOUNTS ||--o{ SCHEDULED_POSTS : "1:N instagram_account_id"

    USERS {
        uuid id PK
        varchar email UK
        varchar password_hash
        varchar name
        int credit_balance
        timestamptz created_at
        timestamptz updated_at
    }
    BRAND_KITS {
        uuid id PK
        uuid user_id FK_UK
        varchar primary_color
        varchar accent_color
        varchar font_family
        varchar default_voice_provider
        varchar default_voice_id
        varchar logo_url
        timestamptz updated_at
    }
    PROJECTS {
        uuid id PK
        uuid user_id FK
        varchar title
        text topic_prompt
        varchar category_preset
        int target_duration_sec
        varchar aspect_ratio
        varchar visual_style
        varchar voice_provider
        varchar voice_id
        float4 voice_speed
        varchar status
        jsonb caption_config
        jsonb bg_music_config
        timestamptz created_at
        timestamptz updated_at
    }
    SCENES {
        uuid id PK
        uuid project_id FK
        int order_index
        varchar scene_type
        text narration_text
        varchar on_screen_headline
        text visual_prompt
        jsonb animation_props
        varchar voiceover_url
        varchar image_url
        jsonb word_timestamps
        int duration_ms
        timestamptz updated_at
    }
    RENDERS {
        uuid id PK
        uuid project_id FK
        uuid user_id FK
        varchar aspect_ratio
        varchar status
        int progress_pct
        varchar current_step
        varchar output_mp4_url
        varchar cover_image_url
        int duration_ms
        text error_message
        timestamptz created_at
    }
    INSTAGRAM_ACCOUNTS {
        uuid id PK
        uuid user_id FK_UK
        varchar ig_user_id
        varchar ig_username
        varchar account_type
        varchar profile_pic_url
        text encrypted_access_token
        timestamptz token_expires_at
        boolean is_sandbox_mock
        varchar status
        timestamptz updated_at
    }
    SCHEDULED_POSTS {
        uuid id PK
        uuid user_id FK
        uuid project_id FK
        uuid render_id FK
        uuid instagram_account_id FK
        text caption
        varchar cover_image_url
        timestamptz scheduled_for
        varchar timezone
        varchar status
        varchar ig_container_id
        varchar ig_media_id
        varchar ig_permalink
        int retry_count
        text last_error
        timestamptz published_at
        timestamptz created_at
    }
    CREDIT_LEDGER {
        uuid id PK
        uuid user_id FK
        uuid project_id FK
        int delta
        int balance_after
        varchar reason
        timestamptz created_at
    }
```

### 3.2 Native Go `GORM` Struct Definitions (`apps/api/internal/models/models.go`)

```go
package models

import (
	"time"
	"github.com/google/uuid"
	"gorm.io/datatypes"
)

type User struct {
	ID            uuid.UUID        `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	Email         string           `gorm:"type:varchar(255);uniqueIndex;not null" json:"email"`
	PasswordHash  string           `gorm:"type:varchar(255);not null" json:"-"`
	Name          string           `gorm:"type:varchar(120);not null" json:"name"`
	CreditBalance int              `gorm:"not null;default:15" json:"credit_balance"`
	BrandKit      *BrandKit        `gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"brand_kit,omitempty"`
	IGAccount     *InstagramAccount`gorm:"foreignKey:UserID;constraint:OnDelete:CASCADE" json:"instagram_account,omitempty"`
	CreatedAt     time.Time        `json:"created_at"`
	UpdatedAt     time.Time        `json:"updated_at"`
}

type BrandKit struct {
	ID                   uuid.UUID `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID               uuid.UUID `gorm:"type:uuid;uniqueIndex;not null" json:"user_id"`
	PrimaryColor         string    `gorm:"type:varchar(20);default:'#6366F1'" json:"primary_color"`
	AccentColor          string    `gorm:"type:varchar(20);default:'#F59E0B'" json:"accent_color"`
	FontFamily           string    `gorm:"type:varchar(80);default:'Inter'" json:"font_family"`
	DefaultVoiceProvider string    `gorm:"type:varchar(40);default:'edge_tts'" json:"default_voice_provider"`
	DefaultVoiceID       string    `gorm:"type:varchar(100);default:'en-US-ChristopherNeural'" json:"default_voice_id"`
	LogoURL              string    `gorm:"type:text" json:"logo_url"`
	UpdatedAt            time.Time `json:"updated_at"`
}

type Project struct {
	ID                uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"id"`
	UserID            uuid.UUID      `gorm:"type:uuid;index:idx_projects_user_created;not null" json:"user_id"`
	Title             string         `gorm:"type:varchar(255);not null" json:"title"`
	TopicPrompt       string         `gorm:"type:text;not null" json:"topic_prompt"`
	CategoryPreset    string         `gorm:"type:varchar(60);not null" json:"category_preset"`
	TargetDurationSec int            `gorm:"not null;default:60" json:"target_duration_sec"` // 30, 60, 90
	AspectRatio       string         `gorm:"type:varchar(10);not null;default:'9:16'" json:"aspect_ratio"` // "9:16" or "16:9"
	VisualStyle       string         `gorm:"type:varchar(60);default:'flat_vector'" json:"visual_style"`
	VoiceProvider     string         `gorm:"type:varchar(40);default:'edge_tts'" json:"voice_provider"` // "edge_tts" or "elevenlabs"
	VoiceID           string         `gorm:"type:varchar(100);default:'en-US-ChristopherNeural'" json:"voice_id"`
	VoiceSpeed        float32        `gorm:"default:1.0" json:"voice_speed"`
	Status            string         `gorm:"type:varchar(40);default:'draft'" json:"status"` // draft, generating_assets, ready, rendering, rendered
	CaptionConfig     datatypes.JSON `gorm:"type:jsonb" json:"caption_config"`
	BgMusicConfig     datatypes.JSON `gorm:"type:jsonb" json:"bg_music_config"`
	Scenes            []Scene        `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE" json:"scenes"`
	Renders           []Render       `gorm:"foreignKey:ProjectID;constraint:OnDelete:CASCADE" json:"renders,omitempty"`
	CreatedAt         time.Time      `gorm:"index:idx_projects_user_created" json:"created_at"`
	UpdatedAt         time.Time      `json:"updated_at"`
}

type Scene struct {
	ID               uuid.UUID      `gorm:"type:uuid;default:gen_random_uuid();primaryKey" json:"scene_id"`
	ProjectID        uuid.UUID      `gorm:"type:uuid;index:idx_scenes_project_order;not null" json:"project_id"`
	OrderIndex       int            `gorm:"index:idx_scenes_project_order;not null" json:"order_index"`
	SceneType        string         `gorm:"type:varchar(50);not null" json:"scene_type"`
	NarrationText    string         `gorm:"type:text;not null" json:"narration_text"`
	OnScreenHeadline string         `gorm:"type:varchar(255)" json:"on_screen_headline"`
	VisualPrompt     string         `gorm:"type:text" json:"visual_prompt"`
	AnimationProps   datatypes.JSON `gorm:"type:jsonb;not null" json:"animation_props"`
	VoiceoverURL     string         `gorm:"type:text" json:"voiceover_url"`
	ImageURL         string         `gorm:"type:text" json:"image_url"`
	WordTimestamps   datatypes.JSON `gorm:"type:jsonb" json:"word_timestamps"`
	DurationMs       int            `gorm:"not null;default:5000" json:"duration_ms"`
	UpdatedAt        time.Time      `json:"updated_at"`
}
```

---

## 4. The Shared Scene & Animation Contract (Go Structs $\leftrightarrow$ TypeScript)

To guarantee type safety across Go (`apps/api`) and Remotion/Next.js (`packages/video-engine` & `apps/web`), all 5 animation templates follow strict struct definitions:

### 4.1 Go Structs for the 5 Animated Scene Types (`apps/api/internal/models/animation_props.go`)

```go
package models

type WordTimestamp struct {
	Word    string `json:"word"`
	StartMs int    `json:"start_ms"`
	EndMs   int    `json:"end_ms"`
}

type CaptionConfig struct {
	Enabled        bool   `json:"enabled"`
	Style          string `json:"style"`           // "karaoke_highlight" | "hormozi_pop" | "kids_read_along" | "clean_minimal"
	FontFamily     string `json:"font_family"`
	TextColor      string `json:"text_color"`
	HighlightColor string `json:"highlight_color"`
	Position       string `json:"position"`        // "bottom_safe" | "middle" | "top"
}

// Template 1: kids_counting (Also covers Alphabet A-Z learning)
type KidsCountingProps struct {
	Mode               string `json:"mode"`                 // "counting" | "alphabet"
	FocusSymbol        string `json:"focus_symbol"`         // e.g. "3" or "A"
	PhoneticWord       string `json:"phonetic_word"`        // e.g. "Apple" or "Three Stars"
	TargetCount        int    `json:"target_count"`         // 1..20 (for counting mode)
	ItemLabel          string `json:"item_label"`           // "Apples"
	ItemEmoji          string `json:"item_emoji"`           // "🍎"
	ThemePalette       string `json:"theme_palette"`        // "playful" | "pastel" | "chalkboard"
	ConfettiOnComplete bool   `json:"confetti_on_complete"`
}

// Template 2: diagram_flow (Animated step-by-step system / process flowchart)
type DiagramNode struct {
	ID       string `json:"id"`
	Title    string `json:"title"`
	Subtitle string `json:"subtitle"`
	Icon     string `json:"icon"` // Emoji or Lucide icon key
}

type DiagramFlowProps struct {
	FlowDirection string        `json:"flow_direction"` // "auto" | "vertical" | "horizontal"
	Nodes         []DiagramNode `json:"nodes"`          // 2 to 5 ordered steps
}

// Template 3: split_comparison (Myth vs. Fact / Old Way vs. New Way)
type ComparisonSide struct {
	BadgeText string   `json:"badge_text"` // e.g. "✗ MYTH" or "✓ FACT"
	Title     string   `json:"title"`
	Points    []string `json:"points"`
	ColorHex  string   `json:"color_hex"`
}

type SplitComparisonProps struct {
	LeftOrTopCard     ComparisonSide `json:"left_or_top_card"`
	RightOrBottomCard ComparisonSide `json:"right_or_bottom_card"`
}

// Template 4: stat_counter (Animated number ticker & multi-bar chart)
type ChartBar struct {
	Label    string  `json:"label"`
	Value    float64 `json:"value"`
	ColorHex string  `json:"color_hex"`
}

type StatCounterProps struct {
	DisplayMode     string     `json:"display_mode"` // "big_number" | "bar_chart"
	TargetNumber    float64    `json:"target_number"`
	NumberPrefix    string     `json:"number_prefix"` // e.g. "$"
	NumberSuffix    string     `json:"number_suffix"` // e.g. "%" or "x"
	TakeawayLabel   string     `json:"takeaway_label"`
	Bars            []ChartBar `json:"bars,omitempty"`
}

// Template 5: illustrated_motion (AI Illustration + Ken Burns camera + Callout badge)
type IllustratedMotionProps struct {
	ArtStyle      string `json:"art_style"`      // "flat_vector" | "pixar_3d" | "whiteboard" | "dark_tech"
	CameraMotion  string `json:"camera_motion"`  // "zoom_in" | "zoom_out" | "pan_left" | "pan_right"
	CalloutBadge  string `json:"callout_badge"`  // Key concept keyword pill
}
```

---

## 5. AI, Voiceover & Parallel Goroutine Pipeline Design

### 5.1 End-to-End Pipeline Sequence Diagram

```mermaid
sequenceDiagram
    actor Member
    participant Web as Next.js Studio
    participant Go as Go API & Orchestrator
    participant Gemini as Gemini 2.5 Flash (+ Groq Fallback)
    participant TTS as Dual TTS (ElevenLabs -> Edge Neural TTS)
    participant Flux as Pollinations Flux Image AI
    participant Store as Cloud / Public Storage

    Member->>Web: 1. Submits Topic + Duration (30s/60s/90s) + Aspect Ratio (9:16 or 16:9)
    Web->>Go: POST /api/v1/projects
    Go->>Gemini: Generate Storyboard JSON with Strict ResponseSchema
    Gemini-->>Go: Validated 6-15 Scenes JSON (scene_type + animation_props)
    Go-->>Web: 201 Created (Project + Ordered Scenes)

    Member->>Web: 2. Clicks "Generate Voiceovers & Visuals" in Studio
    Web->>Go: POST /api/v1/projects/:id/generate-assets
    Web->>Go: Subscribes to GET /api/v1/projects/:id/events (SSE)

    par Concurrent Goroutines (errgroup, limit=4)
        loop For Each Scene 1..N
            Go->>TTS: Synthesize(narration_text, voice_id, speed)
            alt ElevenLabs Selected & Quota Available
                TTS-->>Go: MP3 Bytes + Character/Word Timestamps
            else Edge Neural TTS Selected OR ElevenLabs Quota Error
                TTS-->>Go: Free Edge Neural MP3 Bytes + WordBoundary Timestamps
            end
            Go->>Store: Save Scene Audio (.mp3)
            opt If scene_type == "illustrated_motion"
                Go->>Flux: Generate AI Illustration (visual_prompt, aspect_ratio)
                Flux-->>Go: Illustration Image URL
            end
            Go->>Go: Calculate exact Scene DurationMs = last_word_end_ms + 400ms
            Go-->>Web: SSE Event { type: "scene_ready", scene_id, progress_pct }
        end
    end
    Go-->>Web: SSE Event { type: "assets_complete", progress_pct: 100 }
```

### 5.2 Duration Calibration & Scene Pacing Math
To ensure a `30s`, `60s`, or `90s` video actually finishes on target, the Go LLM prompt builder calculates exact constraints before calling Gemini/Groq:

| Target Duration | Target Total Words (@ 145 WPM) | Scene Count Range | Target Words Per Scene | Credit Cost |
| :--- | :--- | :--- | :--- | :--- |
| **30 Seconds** | `65 – 75 words` | `5 – 6 scenes` | `11 – 14 words/scene` (~5.5s/scene) | **1 Credit** |
| **60 Seconds** | `135 – 155 words` | `8 – 10 scenes` | `14 – 17 words/scene` (~6.5s/scene) | **2 Credits** |
| **90 Seconds** | `205 – 230 words` | `12 – 15 scenes` | `15 – 18 words/scene` (~6.5s/scene) | **3 Credits** |

### 5.3 Dual Voiceover Engine & Word Timestamp Extraction (`internal/services/tts`)
Both voice engines conform to a single Go interface:

```go
type TTSRequest struct {
	Text          string
	VoiceProvider string  // "edge_tts" | "elevenlabs"
	VoiceID       string
	Speed         float32 // 0.85 to 1.20
}

type TTSResult struct {
	AudioBytes     []byte
	DurationMs     int
	WordTimestamps []models.WordTimestamp
	UsedFallback   bool
	FallbackNotice string
}

type TTSProvider interface {
	Synthesize(ctx context.Context, req TTSRequest) (*TTSResult, error)
}
```

* **How ElevenLabs Word Timestamps Are Computed:**
  * Calls `POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id}/with-timestamps`.
  * ElevenLabs returns `audio_base64` plus `alignment.characters`, `alignment.character_start_times_seconds`, and `alignment.character_end_times_seconds`.
  * Our Go aligner groups contiguous non-whitespace characters into words, recording `start_ms = int(first_char_start * 1000)` and `end_ms = int(last_char_end * 1000)`.
* **How Free Edge Neural TTS Word Timestamps Are Computed:**
  * Connects via WebSocket to the Edge Neural Speech service (`wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`) with `"wordBoundaryEnabled": true`.
  * Streams binary `.mp3` chunks while parsing `Path:audio.metadata` JSON messages containing `Type: "WordBoundary"`, `Offset` (in 100-nanosecond ticks $\div 10,000 = \text{ms}$), `Duration`, and `Text`.

---

## 6. Remotion Video, Diagram & Subtitle Engine Design (`packages/video-engine`)

### 6.1 Responsive Dual-Aspect-Ratio Stage (`9:16` vs `16:9`)
The master Remotion composition inspects `project.aspect_ratio`:
* **`9:16` Vertical:** `width = 1080`, `height = 1920`, `fps = 30`.
  * Top Header Zone (`Y: 90px – 260px`): Category badge + `on_screen_headline`.
  * Main Animation Stage (`Y: 280px – 1420px`): Renders one of the 5 animated scene templates in vertical orientation.
  * Subtitle & Safe Zone (`Y: 1440px – 1720px`): Renders word-synced animated captions above Instagram's bottom UI bar.
* **`16:9` Landscape:** `width = 1920`, `height = 1080`, `fps = 30`.
  * Top Header Zone (`Y: 48px – 160px`): Headline & step progress bar.
  * Main Animation Stage (`Y: 170px – 880px`): Renders the animated scene template in wide horizontal orientation.
  * Subtitle Zone (`Y: 890px – 1020px`): Centered bottom subtitles.

### 6.2 Frame-Accurate Word & Counting Synchronization Algorithm
Inside every Remotion scene component:
1. Convert current Remotion frame to milliseconds:
   $$\text{currentMs} = \frac{\text{useCurrentFrame}()}{\text{fps}} \times 1000$$
2. **Subtitle Overlay (`SubtitleOverlay.tsx`):**
   * Groups `word_timestamps` into readable chunks of **4 words** (for `9:16`) or **7 words** (for `16:9`).
   * Finds the active chunk where `chunk.start_ms <= currentMs <= chunk.end_ms`.
   * For the active word (`word.start_ms <= currentMs <= word.end_ms`), applies a spring scale (`spring({ frame: frame - wordStartFrame, fps, config: { damping: 12, stiffness: 220 } })`) and highlights it in `captionConfig.highlight_color`.
3. **Kids Counting Pop-In Sync (`KidsCountingScene.tsx`):**
   * Scans `word_timestamps` for number words (`"one"`, `"1"`, `"two"`, `"2"`, etc.) or evenly distributes pop triggers across the voiceover duration.
   * Item $k \in [1..\text{targetCount}]$ animates onto the stage with a bouncy spring when $\text{currentMs} \ge \text{popTriggerMs}[k-1]$.

---

## 7. Multi-Tenant Security & Per-Member Instagram Scheduler Design

### 7.1 Per-Member Token Encryption (AES-256-GCM)
When a member connects their personal Instagram Creator/Business account via OAuth:
1. Go exchanges the short-lived authorization code for a **60-day Long-Lived Access Token**.
2. Before writing to `instagram_accounts.encrypted_access_token`, Go encrypts the token using **AES-256-GCM** with `TOKEN_ENCRYPTION_KEY` (32-byte server secret) and prepends the random 12-byte nonce.
3. Tokens are only decrypted in memory at the exact moment a scheduled or instant Reel is published for that `user_id`.

### 7.2 Crash-Safe 60-Second Go Cron Worker (`internal/worker/scheduler.go`)
Every 60 seconds, a background goroutine executes:
1. Begins a short PostgreSQL transaction:
   ```sql
   SELECT * FROM scheduled_posts
   WHERE status = 'scheduled' AND scheduled_for <= NOW()
   ORDER BY scheduled_for ASC
   LIMIT 5
   FOR UPDATE SKIP LOCKED;
   ```
2. Updates claimed rows to `status = 'publishing'` and commits the lock transaction.
3. For each claimed post, spawns an isolated publishing worker that:
   * Loads the member's `InstagramAccount` (`WHERE id = post.instagram_account_id AND user_id = post.user_id`).
   * If `is_sandbox_mock == true`, simulates container processing for 3 seconds and marks `status = 'published'` with a simulated permalink (`https://www.instagram.com/reel/MOCK_REEL_ID/`).
   * If live OAuth account:
     1. Calls `POST https://graph.facebook.com/v21.0/{ig_user_id}/media` (`media_type=REELS`, `video_url={output_mp4_url}`, `caption={caption}`).
     2. Polls `GET /{container_id}?fields=status_code,status` every 5 seconds (up to 24 attempts / 2 minutes) until `status_code == "FINISHED"`.
     3. Calls `POST https://graph.facebook.com/v21.0/{ig_user_id}/media_publish` (`creation_id={container_id}`).
     4. Queries `GET /{media_id}?fields=permalink` and updates `scheduled_posts` with `status = 'published'`, `ig_media_id`, `ig_permalink`, and `published_at = NOW()`.
   * On transient failure, increments `retry_count`. If `retry_count < 3`, reschedules `scheduled_for = NOW() + 5 minutes` with `status = 'scheduled'`; otherwise sets `status = 'failed'` and records `last_error`.

---

## 8. Environment Variables Specification (`.env.example`)

```dotenv
# --- Server & Security ---
PORT=8080
FRONTEND_URL=http://localhost:3000
NEXT_PUBLIC_API_URL=http://localhost:8080/api/v1
JWT_SECRET=animora-super-secret-jwt-key-change-in-prod
TOKEN_ENCRYPTION_KEY=0123456789abcdef0123456789abcdef # 32-byte key for AES-256-GCM

# --- PostgreSQL Database (Supabase or Neon Free Tier) ---
DATABASE_URL=postgres://user:password@ep-example.us-east-2.aws.neon.tech/animora?sslmode=require

# --- AI LLMs (Free Tiers) ---
GEMINI_API_KEY=your_free_google_ai_studio_key
GROQ_API_KEY=your_optional_free_groq_key

# --- Voiceover / TTS (Edge Neural TTS works 100% free with NO key!) ---
DEFAULT_TTS_PROVIDER=edge_tts
ELEVENLABS_API_KEY=your_optional_elevenlabs_free_tier_key

# --- Public Storage (Local Dev Fallback + Supabase Storage / Cloudflare R2 Free Tier) ---
STORAGE_PROVIDER=local # "local" | "supabase" | "r2"
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your_optional_supabase_service_key
SUPABASE_BUCKET=animora-media

# --- Meta Instagram Graph API (Optional in Dev — Sandbox Mock Mode works out of the box) ---
META_APP_ID=your_meta_app_id
META_APP_SECRET=your_meta_app_secret
META_REDIRECT_URI=http://localhost:8080/api/v1/instagram/oauth/callback
```
