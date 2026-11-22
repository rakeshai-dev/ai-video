# API Design Specification: Animora Studio (`REST` + `SSE`)
**Product Name:** Animora Studio — AI Educational & Animated Video SaaS Platform  
**API Version:** `v1` (`/api/v1`)  
**Related Documents:** [PRD.md](file:///c:/Users/rk751/Projects/AI%20Video/PRD.md) • [SYSTEM_DESIGN.md](file:///c:/Users/rk751/Projects/AI%20Video/SYSTEM_DESIGN.md) • [TECHNICAL_DESIGN.md](file:///c:/Users/rk751/Projects/AI%20Video/TECHNICAL_DESIGN.md)  
**Backend Implementation:** Go (Golang 1.23+) • `Chi` Router • PostgreSQL (`GORM`) • Server-Sent Events (`text/event-stream`)

---

## 1. API Architecture, Conventions & Security Standards

### 1.1 Base URLs & Content Types
* **Local Development Base URL:** `http://localhost:8080/api/v1`
* **Production Base URL:** `https://api.animora.studio/api/v1`
* **Request / Response Format:** `Content-Type: application/json; charset=utf-8`
* **Real-Time Stream Format:** `Content-Type: text/event-stream` (Server-Sent Events)
* **Timestamp Format:** ISO-8601 UTC / RFC3339 (e.g., `"2026-11-21T18:30:00Z"`)
* **Primary Keys:** UUID v4 (e.g., `"d290f1ee-6c54-4b01-90e6-d701748f0851"`)

### 1.2 Authentication & Strict Per-Member Multi-Tenancy
1. **Dual-Transport JWT Authentication:**
   * **Browser Cookie (Default for Next.js):** `Set-Cookie: animora_token=<JWT>; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`
   * **Authorization Header (Supported for SSR / API clients):** `Authorization: Bearer <JWT>`
2. **JWT Claims Structure (`HS256`):**
   ```json
   {
     "sub": "8f14e45f-ceea-467a-a838-6b2022423c01",
     "email": "creator@example.com",
     "name": "Aarav Sharma",
     "iat": 1763740000,
     "exp": 1764344800
   }
   ```
3. **Tenant Isolation Guarantee:**
   * The Go `TenantAuthMiddleware` extracts `user_id` (`sub`) from the verified JWT.
   * The client **never** passes `user_id` in request bodies or query strings; every SQL query in Go is automatically scoped with `WHERE user_id = currentUserID`.
   * Attempting to access or mutate another member's project, scene, render, or Instagram schedule returns `404 Not Found` (preventing ID enumeration across members).

---

### 1.3 Standard JSON Response Envelope & Error Catalog

#### Success Response Envelope (`200 OK`, `201 Created`, `202 Accepted`)
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "request_id": "req_9a8b7c6d"
  }
}
```

#### Error Response Envelope (`400`, `401`, `403`, `404`, `409`, `422`, `429`, `500`)
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_CREDITS",
    "message": "Exporting a 90-second MP4 requires 3 credits, but your current balance is 1 credit.",
    "details": {
      "required_credits": 3,
      "available_credits": 1
    }
  }
}
```

#### Standard Error Code Reference Table

| HTTP Status | Error `code` | Trigger Condition |
| :--- | :--- | :--- |
| `400 Bad Request` | `VALIDATION_ERROR` | Missing required fields, invalid duration (`must be 30, 60, or 90`), or invalid aspect ratio (`must be 9:16 or 16:9`). |
| `401 Unauthorized` | `UNAUTHORIZED` | Missing, expired, or invalid JWT cookie/header. |
| `401 Unauthorized` | `INVALID_CREDENTIALS` | Wrong email or password on `/auth/login`. |
| `402 Payment Required` | `INSUFFICIENT_CREDITS` | Member attempts to render a final MP4 without enough video credits (`30s=1`, `60s=2`, `90s=3`). |
| `404 Not Found` | `RESOURCE_NOT_FOUND` | Project, Scene, Render, or Scheduled Post ID does not exist or belongs to another member. |
| `409 Conflict` | `EMAIL_ALREADY_EXISTS` | Email is already registered on `/auth/register`. |
| `409 Conflict` | `RENDER_IN_PROGRESS` | Member triggers a duplicate MP4 render while one is already running for that project. |
| `422 Unprocessable` | `IG_NOT_CONNECTED` | Member attempts to publish or schedule to Instagram before connecting their Instagram account. |
| `429 Too Many Requests`| `RATE_LIMIT_EXCEEDED` | Exceeded per-member burst limit on AI generation endpoints. |
| `502 Bad Gateway` | `UPSTREAM_PROVIDER_ERROR` | Both primary and fallback AI/Graph API providers failed after retry. |

---

## 2. Master API Endpoint Matrix (All 28 Endpoints Mapped to Dashboard Pages)

| # | Method | Endpoint Path | Auth? | Dashboard Page | PRD Feature | Summary |
| :- | :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | `GET` | `/api/v1/health` | Public | System | Infra | Health & DB connectivity check |
| **2** | `POST` | `/api/v1/auth/register` | Public | Page 2 (`/signup`) | Feature 1.1–1.4 | Register member + grant 15 free credits + init Brand Kit |
| **3** | `POST` | `/api/v1/auth/login` | Public | Page 3 (`/login`) | Feature 1.1 | Authenticate member & set JWT cookie |
| **4** | `POST` | `/api/v1/auth/logout` | JWT | All Pages | Feature 1.1 | Clear JWT session cookie |
| **5** | `GET` | `/api/v1/me` | JWT | Page 4, 10 | Feature 1.2, 2.1 | Get member profile, credits, Brand Kit, IG status & stats |
| **6** | `PUT` | `/api/v1/brand-kit` | JWT | Page 10 (`/settings`) | Feature 1.4 | Update member's default Brand Kit & default voice |
| **7** | `GET` | `/api/v1/credits/ledger` | JWT | Page 10 (`/settings`) | Feature 7.3 | List member's credit grant & deduction history |
| **8** | `POST` | `/api/v1/ai/brainstorm` | JWT | Page 5 (`/create`) | Feature 3.1 | AI generates 5 hook-driven educational/kids video ideas |
| **9** | `GET` | `/api/v1/voices` | JWT | Page 5, 6, 10 | Feature 3.5 | List available Free Edge Neural & ElevenLabs voice personas |
| **10** | `GET` | `/api/v1/projects` | JWT | Page 4 (`/dashboard`) | Feature 2.1 | List member's video projects (filterable by status) |
| **11** | `POST` | `/api/v1/projects` | JWT | Page 5 (`/create`) | Feature 4.1, 4.2 | Create project & generate AI timed script + 6–15 animated scenes |
| **12** | `GET` | `/api/v1/projects/:id` | JWT | Page 6, 7 | Feature 4.3, 4.4 | Fetch full project, ordered scenes, and render history |
| **13** | `PATCH` | `/api/v1/projects/:id` | JWT | Page 6 (`/studio`) | Feature 3.4, 6.3 | Update title, aspect ratio (`9:16`/`16:9`), voice, or captions |
| **14** | `DELETE`| `/api/v1/projects/:id` | JWT | Page 4 (`/dashboard`) | Feature 2.3 | Delete project and associated scenes/renders |
| **15** | `POST` | `/api/v1/projects/:id/duplicate` | JWT | Page 4 (`/dashboard`) | Feature 2.3 | Duplicate an existing project & storyboard |
| **16** | `PUT` | `/api/v1/projects/:id/scenes/:sceneId` | JWT | Page 6 (`/studio`) | Feature 4.3, 5.1–5.5 | Update a scene's script, headline, `scene_type`, or `animation_props` |
| **17** | `POST` | `/api/v1/projects/:id/scenes` | JWT | Page 6 (`/studio`) | Feature 4.3 | Add a new scene card to the project storyboard |
| **18** | `DELETE`| `/api/v1/projects/:id/scenes/:sceneId` | JWT | Page 6 (`/studio`) | Feature 4.3 | Delete a scene card & re-index scene order |
| **19** | `POST` | `/api/v1/projects/:id/scenes/reorder` | JWT | Page 6 (`/studio`) | Feature 4.3 | Save drag-and-drop scene ordering |
| **20** | `POST` | `/api/v1/projects/:id/generate-assets` | JWT | Page 6 (`/studio`) | Feature 6.1, 6.2 | Spawn parallel goroutines for TTS voiceovers + timestamps + visuals |
| **21** | `POST` | `/api/v1/projects/:id/scenes/:sceneId/regenerate` | JWT | Page 6 (`/studio`) | Feature 6.5 | Re-generate voiceover or AI visual for a single scene |
| **22** | `POST` | `/api/v1/projects/:id/render` | JWT | Page 6, 7 | Feature 7.1–7.3 | Deduct credits & trigger headless 1080p MP4 render |
| **23** | `GET` | `/api/v1/projects/:id/events` | JWT | Page 6, 7 | Feature 6.1, 7.1 | **SSE Stream:** Real-time asset & MP4 render progress events |
| **24** | `GET` | `/api/v1/instagram/account` | JWT | Page 7, 9 | Feature 8.1 | Get member's connected Instagram account status |
| **25** | `GET` | `/api/v1/instagram/oauth/start` | JWT | Page 9 (`/integrations`)| Feature 8.1 | Redirect member to Meta Instagram OAuth 2.0 login |
| **26** | `GET` | `/api/v1/instagram/oauth/callback` | Public | Page 9 (`/integrations`)| Feature 8.1 | OAuth callback $\rightarrow$ encrypt & save member's 60-day IG token |
| **27** | `POST` | `/api/v1/instagram/connect-mock` | JWT | Page 9 (`/integrations`)| Feature 8.1 | Connect/toggle Sandbox Mock Instagram account (`@creator_demo`) |
| **28** | `DELETE`| `/api/v1/instagram/account` | JWT | Page 9 (`/integrations`)| Feature 8.1 | Disconnect member's Instagram account |
| **29** | `POST` | `/api/v1/projects/:id/generate-caption`| JWT | Page 7 (`/publish`) | Feature 8.2 | AI generates Instagram Reel caption & hashtags from script |
| **30** | `POST` | `/api/v1/publish/instagram` | JWT | Page 7 (`/publish`) | Feature 8.4, 8.5 | Publish Reel immediately (`mode: "now"`) or schedule (`mode: "schedule"`) |
| **31** | `GET` | `/api/v1/schedule` | JWT | Page 8 (`/calendar`) | Feature 8.5 | List member's scheduled, publishing, published & failed Reels |
| **32** | `PATCH` | `/api/v1/schedule/:postId` | JWT | Page 8 (`/calendar`) | Feature 8.5 | Reschedule timestamp or edit caption of a pending post |
| **33** | `POST` | `/api/v1/schedule/:postId/retry` | JWT | Page 8 (`/calendar`) | Feature 8.5 | Trigger immediate retry on a failed Instagram post |
| **34** | `DELETE`| `/api/v1/schedule/:postId` | JWT | Page 8 (`/calendar`) | Feature 8.5 | Cancel a scheduled Instagram post |

---

## 3. Module 1: Authentication, Member Workspace & Brand Kit APIs

### 3.1 `POST /api/v1/auth/register`
Registers a new member, hashes their password (`bcrypt`), grants **15 free starter credits** in `credit_ledger`, creates their default `brand_kits` row, and sets the JWT cookie.

* **Request Body:**
  ```json
  {
    "name": "Rohan Kumar",
    "email": "rohan@animora.studio",
    "password": "SecurePassword123!"
  }
  ```
* **Validation Rules:**
  * `name`: required, 2–120 chars
  * `email`: required, valid email format, lowercase normalized, unique in `users`
  * `password`: required, min 8 chars
* **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "user": {
        "id": "8f14e45f-ceea-467a-a838-6b2022423c01",
        "name": "Rohan Kumar",
        "email": "rohan@animora.studio",
        "credit_balance": 15,
        "created_at": "2026-11-21T17:00:00Z"
      },
      "brand_kit": {
        "id": "b101e45f-ceea-467a-a838-6b2022423c99",
        "primary_color": "#6366F1",
        "accent_color": "#F59E0B",
        "font_family": "Inter",
        "default_voice_provider": "edge_tts",
        "default_voice_id": "en-US-ChristopherNeural",
        "logo_url": ""
      }
    }
  }
  ```

---

### 3.2 `POST /api/v1/auth/login`
Authenticates an existing member and issues a fresh 7-day JWT.

* **Request Body:**
  ```json
  {
    "email": "rohan@animora.studio",
    "password": "SecurePassword123!"
  }
  ```
* **Response (`200 OK`):** Same structure as `/auth/register`, plus `instagram_account` summary if connected.

---

### 3.3 `GET /api/v1/me`
Called on Dashboard load (Page 4) to hydrate the member's session, credit balance, Brand Kit, connected Instagram account, and dashboard counters.

* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "user": {
        "id": "8f14e45f-ceea-467a-a838-6b2022423c01",
        "name": "Rohan Kumar",
        "email": "rohan@animora.studio",
        "credit_balance": 13
      },
      "brand_kit": {
        "primary_color": "#6366F1",
        "accent_color": "#F59E0B",
        "font_family": "Inter",
        "default_voice_provider": "edge_tts",
        "default_voice_id": "en-US-ChristopherNeural",
        "logo_url": ""
      },
      "instagram_account": {
        "connected": true,
        "ig_username": "rohan_explains",
        "account_type": "CREATOR",
        "is_sandbox_mock": false,
        "token_expires_at": "2027-01-20T17:00:00Z"
      },
      "dashboard_stats": {
        "total_projects": 4,
        "rendered_videos": 2,
        "scheduled_posts": 1,
        "published_posts": 1
      }
    }
  }
  ```

---

### 3.4 `PUT /api/v1/brand-kit`
Updates the logged-in member's default Brand Kit (Page 10 `/dashboard/settings`).

* **Request Body:**
  ```json
  {
    "primary_color": "#3B82F6",
    "accent_color": "#10B981",
    "font_family": "Fredoka",
    "default_voice_provider": "edge_tts",
    "default_voice_id": "en-US-AnaNeural",
    "logo_url": "https://storage.animora.studio/logos/user_8f14.png"
  }
  ```
* **Response (`200 OK`):** Returns the updated `brand_kit` object.

---

## 4. Module 2: AI Brainstorming & Project / Storyboard Creation APIs

### 4.1 `POST /api/v1/ai/brainstorm`
Used on **Page 5 (`/dashboard/create` — Tab 1: "Ask AI to Brainstorm Ideas")**. Calls **Gemini 2.5 Flash** (or **Groq Llama 3.3 70B** on fallback) to generate 5 hook-driven educational or kids-learning video concepts.

* **Request Body:**
  ```json
  {
    "niche_or_topic": "Kids learning Alphabet A to E and counting 1 to 5",
    "category_preset": "kids_learning",
    "target_duration_sec": 60
  }
  ```
  *Allowed `category_preset` values:* `"technical_explainer"` | `"kids_learning"` | `"myth_vs_fact"` | `"data_stats"` | `"illustrated_story"`
  *Allowed `target_duration_sec` values:* `30` | `60` | `90`
* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "provider_used": "gemini-2.5-flash",
      "ideas": [
        {
          "id": "idea_1",
          "title": "Count 1 to 5 Orchard Apples & Learn A-B-C!",
          "hook_line": "Can you help our friendly orchard character count five shiny red apples and learn letters A, B, and C?",
          "visual_concept": "Bouncing 3D letters A, B, C followed by interactive apples popping in 1-by-1 with confetti celebration.",
          "recommended_preset": "kids_learning",
          "recommended_voice_id": "en-US-AnaNeural"
        }
      ]
    }
  }
  ```

---

### 4.2 `GET /api/v1/voices`
Returns the catalog of built-in **Free Edge Neural TTS** voices and **ElevenLabs** voices so the frontend voice picker can show badges (`FREE UNLIMITED` vs `ELEVENLABS`) and sample preview audio.

* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "elevenlabs_configured": true,
      "voices": [
        {
          "voice_id": "en-US-AnaNeural",
          "provider": "edge_tts",
          "name": "Ana (Cheerful Kids & Early Learning)",
          "accent": "US English",
          "category": "kids_learning",
          "is_free_unlimited": true
        },
        {
          "voice_id": "en-US-ChristopherNeural",
          "provider": "edge_tts",
          "name": "Christopher (Clear Science & Tech Explainer)",
          "accent": "US English",
          "category": "technical_explainer",
          "is_free_unlimited": true
        },
        {
          "voice_id": "en-US-AriaNeural",
          "provider": "edge_tts",
          "name": "Aria (Energetic Instagram Reels Host)",
          "accent": "US English",
          "category": "general",
          "is_free_unlimited": true
        },
        {
          "voice_id": "en-IN-NeerjaNeural",
          "provider": "edge_tts",
          "name": "Neerja (Clear Indian English Educator)",
          "accent": "Indian English",
          "category": "technical_explainer",
          "is_free_unlimited": true
        },
        {
          "voice_id": "JBFqnCBsd6RMkjVDRZzb",
          "provider": "elevenlabs",
          "name": "George (ElevenLabs Warm Storyteller)",
          "accent": "British/US",
          "category": "general",
          "is_free_unlimited": false
        }
      ]
    }
  }
  ```

---

### 4.3 `POST /api/v1/projects`
Used when the member clicks **"Generate Script & Animated Storyboard ➔"** on **Page 5 (`/dashboard/create`)**.
1. Calculates the target word count and scene count for `30s` (5–6 scenes), `60s` (8–10 scenes), or `90s` (12–15 scenes).
2. Calls **Gemini 2.5 Flash** (or **Groq** fallback) with strict JSON schema enforcement to generate the complete single-topic script split into scenes, automatically choosing the best `scene_type` and `animation_props` for each scene.
3. Saves the `Project` and ordered `Scene[]` rows in PostgreSQL inside a single `GORM` transaction.

* **Request Body:**
  ```json
  {
    "title": "How Solar Panels Turn Sunlight Into Electricity",
    "topic_prompt": "Explain step by step how silicon solar panels convert sunlight photons into DC electricity and how the solar inverter converts it into AC electricity for a home.",
    "category_preset": "technical_explainer",
    "target_duration_sec": 60,
    "aspect_ratio": "9:16",
    "visual_style": "dark_tech",
    "voice_provider": "edge_tts",
    "voice_id": "en-US-ChristopherNeural",
    "voice_speed": 1.0
  }
  ```
* **Response (`201 Created`):**
  ```json
  {
    "success": true,
    "data": {
      "project": {
        "id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
        "user_id": "8f14e45f-ceea-467a-a838-6b2022423c01",
        "title": "How Solar Panels Turn Sunlight Into Electricity",
        "topic_prompt": "Explain step by step how silicon solar panels convert sunlight photons...",
        "category_preset": "technical_explainer",
        "target_duration_sec": 60,
        "aspect_ratio": "9:16",
        "visual_style": "dark_tech",
        "voice_provider": "edge_tts",
        "voice_id": "en-US-ChristopherNeural",
        "voice_speed": 1.0,
        "status": "draft",
        "caption_config": {
          "enabled": true,
          "style": "karaoke_highlight",
          "font_family": "Inter",
          "text_color": "#FFFFFF",
          "highlight_color": "#FBBF24",
          "position": "bottom_safe"
        },
        "bg_music_config": {
          "track_id": "ambient_science",
          "volume": 0.12
        },
        "scenes": [
          {
            "scene_id": "11111111-2222-3333-4444-555555555501",
            "order_index": 1,
            "scene_type": "illustrated_motion",
            "on_screen_headline": "How Sunlight Powers Your Entire Home",
            "narration_text": "Have you ever wondered how a flat glass panel on a roof can power an entire house using only sunlight?",
            "visual_prompt": "Glowing sun shooting golden photon particles onto a modern house roof with blue solar panels",
            "duration_ms": 6200,
            "voiceover_url": "",
            "image_url": "",
            "word_timestamps": [
              { "word": "Have", "start_ms": 100, "end_ms": 340 },
              { "word": "you", "start_ms": 340, "end_ms": 520 }
            ],
            "animation_props": {
              "art_style": "dark_tech",
              "camera_motion": "zoom_in",
              "callout_badge": "☀️ Solar Energy Science Explained"
            }
          }
        ]
      }
    }
  }
  ```

---

## 5. Module 3: Interactive Storyboard & Scene Editing APIs

### 5.1 `PUT /api/v1/projects/:id/scenes/:sceneId`
Used by the **3-Tab Scene Inspector** on **Page 6 (`/dashboard/projects/[id]/studio`)** whenever the member edits a scene's narration text, headline, `scene_type`, or `animation_props`.

* **Request Body:**
  ```json
  {
    "scene_type": "diagram_flow",
    "on_screen_headline": "Inside a Silicon Photovoltaic Cell",
    "narration_text": "Every solar panel contains silicon cells built like a sandwich: an N-type layer on top, a P-type layer below, and an electric field junction in the middle.",
    "visual_prompt": "Cross section diagram of N-type and P-type silicon solar cell",
    "animation_props": {
      "flow_direction": "auto",
      "nodes": [
        {
          "id": "n1",
          "title": "Top: N-Type Silicon",
          "subtitle": "Extra negatively charged electrons (e⁻)",
          "icon": "➖"
        },
        {
          "id": "n2",
          "title": "Middle: P-N Electric Junction",
          "subtitle": "One-way internal electric field barrier",
          "icon": "⚡"
        },
        {
          "id": "n3",
          "title": "Bottom: P-Type Silicon",
          "subtitle": "Positively charged electron holes (+)",
          "icon": "➕"
        }
      ]
    }
  }
  ```
* **Backend Behavior:**
  * Validates `animation_props` against the Go struct for `scene_type`.
  * If `narration_text` changed and no new TTS voiceover has been generated yet, recalculates estimated `word_timestamps` and `duration_ms` immediately so the live 60fps `@remotion/player` preview stays in sync!
* **Response (`200 OK`):** Returns the updated `Scene` object.

---

### 5.2 `POST /api/v1/projects/:id/scenes/reorder`
Persists Framer Motion drag-and-drop scene reordering in the Left Timeline of Page 6.

* **Request Body:**
  ```json
  {
    "ordered_scene_ids": [
      "11111111-2222-3333-4444-555555555502",
      "11111111-2222-3333-4444-555555555501",
      "11111111-2222-3333-4444-555555555503"
    ]
  }
  ```
* **Response (`200 OK`):** Returns the re-indexed `scenes[]` array (`order_index: 1..N`).

---

## 6. Module 4: Parallel Asset Generation, MP4 Rendering & Real-Time SSE APIs

### 6.1 `POST /api/v1/projects/:id/generate-assets`
Triggers the Go **Parallel Goroutine Asset Orchestrator (`errgroup`, max 4 concurrent workers)** to synthesize voiceovers (**ElevenLabs** or **Free Edge Neural TTS** with automatic fallback), extract millisecond word timestamps, and generate scene visuals for all scenes in the project.

* **Request Body (Optional Overrides):**
  ```json
  {
    "voice_provider": "edge_tts",
    "voice_id": "en-US-ChristopherNeural",
    "voice_speed": 1.0,
    "force_regenerate_all": false
  }
  ```
* **Response (`202 Accepted`):**
  ```json
  {
    "success": true,
    "data": {
      "project_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
      "status": "generating_assets",
      "total_scenes": 8,
      "sse_stream_url": "/api/v1/projects/d290f1ee-6c54-4b01-90e6-d701748f0851/events"
    }
  }
  ```

---

### 6.2 `POST /api/v1/projects/:id/render`
Triggered when the member clicks **"Render Final MP4"** on Page 6 or Page 7.
1. Checks member's `credit_balance` against duration cost (`30s = 1 credit`, `60s = 2 credits`, `90s = 3 credits`).
2. Deducts credits atomically in PostgreSQL and records a `credit_ledger` entry.
3. Creates a `Render` row (`status = "rendering"`) and spawns the background Headless Remotion + FFmpeg MP4 render job (`1080×1920` for `9:16` or `1920×1080` for `16:9`).

* **Request Body:**
  ```json
  {
    "aspect_ratio": "9:16"
  }
  ```
* **Response (`202 Accepted`):**
  ```json
  {
    "success": true,
    "data": {
      "render_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
      "project_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
      "aspect_ratio": "9:16",
      "status": "rendering",
      "credits_deducted": 2,
      "remaining_credit_balance": 13,
      "sse_stream_url": "/api/v1/projects/d290f1ee-6c54-4b01-90e6-d701748f0851/events"
    }
  }
  ```

---

### 6.3 `GET /api/v1/projects/:id/events` (Server-Sent Events Stream)
Streams real-time pipeline events to the Next.js Studio and Publish pages.

* **Headers:**
  ```http
  Content-Type: text/event-stream
  Cache-Control: no-cache
  Connection: keep-alive
  ```
* **Event Stream Examples:**
  ```text
  event: progress
  data: {"project_id":"d290f1ee...","phase":"generating_assets","progress_pct":37,"current_step_label":"Synthesized voiceover for Scene 3 of 8 (16.0s)","updated_scene_id":"11111111...","used_tts_fallback":false}

  event: progress
  data: {"project_id":"d290f1ee...","phase":"assets_ready","progress_pct":100,"current_step_label":"All 8 scene voiceovers and animations ready for 60fps preview!"}

  event: progress
  data: {"project_id":"d290f1ee...","phase":"rendering_mp4","render_id":"f47ac10b...","progress_pct":65,"current_step_label":"Encoding 1080x1920 H.264 frames (2060 / 3174)..."}

  event: progress
  data: {"project_id":"d290f1ee...","phase":"render_complete","render_id":"f47ac10b...","progress_pct":100,"current_step_label":"Final MP4 Ready!","output_mp4_url":"http://localhost:8080/uploads/renders/solar-explainer-video.mp4"}
  ```

---

## 7. Module 5: Per-Member Instagram Connect, AI Social Caption & Scheduler APIs

### 7.1 `GET /api/v1/instagram/account` & `POST /api/v1/instagram/connect-mock`
Allows each member to view their own connected Instagram account on **Page 9 (`/dashboard/integrations`)** or connect a Sandbox Mock Creator account (`@rohan_explains_demo`) for one-click local testing before Meta App Review.

* **`POST /api/v1/instagram/connect-mock` Request Body:**
  ```json
  {
    "ig_username": "rohan_explains"
  }
  ```
* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "instagram_account": {
        "id": "ig_99887766-5544-3322-1100-aabbccddeeff",
        "user_id": "8f14e45f-ceea-467a-a838-6b2022423c01",
        "ig_user_id": "17841405822304914",
        "ig_username": "rohan_explains",
        "account_type": "CREATOR",
        "is_sandbox_mock": true,
        "status": "active",
        "token_expires_at": "2027-01-20T17:00:00Z"
      }
    }
  }
  ```

---

### 7.2 `POST /api/v1/projects/:id/generate-caption`
Used on **Page 7 (`/dashboard/projects/[id]/publish`)** to auto-generate the Instagram Reel post caption and hashtags from the project's script.

* **Request Body:**
  ```json
  {
    "tone": "educational",
    "include_cta": true,
    "hashtag_count": 10
  }
  ```
  *Allowed `tone` values:* `"educational"` | `"kids_parent_friendly"` | `"viral_hook"` | `"professional_brand"`
* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "caption": "Ever wondered how a flat glass panel on your roof turns silent sunlight into 240V electricity for your home? ☀️⚡\n\nHere is the step-by-step science:\n• Photons knock electrons free inside N-type & P-type silicon layers\n• Flowing electrons create Direct Current (DC)\n• Your solar inverter transforms DC into 60Hz Alternating Current (AC)\n• Extra daytime energy charges your home battery for nighttime!\n\nSave this Reel for later & follow for more visual explainers! 👇",
      "hashtags": [
        "#SolarEnergy",
        "#HowItWorks",
        "#ScienceExplained",
        "#CleanEnergy",
        "#Engineering",
        "#RenewableEnergy",
        "#STEMEducation",
        "#TechExplainer",
        "#HomeSolar",
        "#LearnOnReels"
      ],
      "full_formatted_caption": "Ever wondered how a flat glass panel on your roof turns silent sunlight into 240V electricity for your home? ☀️⚡\n\n...",
      "character_count": 562
    }
  }
  ```

---

### 7.3 `POST /api/v1/publish/instagram`
Handles both **1-Click "Post to Instagram Now"** (`mode: "now"`) and **"Schedule to Content Calendar"** (`mode: "schedule"`) for the logged-in member's connected Instagram account.

* **Request Body:**
  ```json
  {
    "project_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
    "render_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
    "caption": "Ever wondered how a flat glass panel on your roof turns silent sunlight into 240V electricity? ☀️⚡ #SolarEnergy #ScienceExplained",
    "mode": "now",
    "scheduled_for": null,
    "timezone": "Asia/Kolkata"
  }
  ```
* **Response for `mode: "now"` (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "scheduled_post": {
        "id": "sp_77665544-3322-1100-9988-aabbccddeeff",
        "project_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
        "render_id": "f47ac10b-58cc-4372-a567-0e02b2c3d479",
        "ig_username": "rohan_explains",
        "status": "published",
        "ig_container_id": "17895695668004550",
        "ig_media_id": "17920485911004550",
        "ig_permalink": "https://www.instagram.com/reel/DC9xSolarExplainer/",
        "published_at": "2026-11-21T17:15:08Z"
      }
    }
  }
  ```
* **Response for `mode: "schedule"` (`201 Created`):** Returns `status: "scheduled"` and `scheduled_for: "2026-11-25T18:00:00+05:30"`, queuing it for the 60-second Go PostgreSQL Cron Worker.

---

### 7.4 `GET /api/v1/schedule`
Powers **Page 8 (`/dashboard/calendar` — Content Calendar & Scheduled Posts)** for the logged-in member.

* **Query Parameters:** `?status=all|scheduled|publishing|published|failed&month=2026-11`
* **Response (`200 OK`):**
  ```json
  {
    "success": true,
    "data": {
      "posts": [
        {
          "id": "sp_77665544-3322-1100-9988-aabbccddeeff",
          "project_id": "d290f1ee-6c54-4b01-90e6-d701748f0851",
          "project_title": "How Solar Panels Turn Sunlight Into Electricity",
          "output_mp4_url": "http://localhost:8080/uploads/renders/solar-explainer-video.mp4",
          "ig_username": "rohan_explains",
          "caption": "Ever wondered how a flat glass panel on your roof...",
          "scheduled_for": "2026-11-25T12:30:00Z",
          "timezone": "Asia/Kolkata",
          "status": "scheduled",
          "ig_permalink": "",
          "retry_count": 0,
          "last_error": ""
        }
      ]
    }
  }
  ```
