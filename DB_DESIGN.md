# Database Design Document (DDD): Animora Studio (`PostgreSQL` + Go `GORM`)
**Product Name:** Animora Studio — AI Educational & Animated Video SaaS Platform  
**Database Engine:** PostgreSQL 16+ (Supabase / Neon Serverless Free Tier)  
**ORM & Driver:** Native Go `GORM` (`gorm.io/gorm`, `gorm.io/driver/postgres`, `gorm.io/datatypes`)  
**Related Documents:** [PRD.md](file:///c:/Users/rk751/Projects/AI%20Video/PRD.md) • [SYSTEM_DESIGN.md](file:///c:/Users/rk751/Projects/AI%20Video/SYSTEM_DESIGN.md) • [TECHNICAL_DESIGN.md](file:///c:/Users/rk751/Projects/AI%20Video/TECHNICAL_DESIGN.md) • [API_DESIGN.md](file:///c:/Users/rk751/Projects/AI%20Video/API_DESIGN.md)

---

## 1. Database Architecture, Naming Conventions & Multi-Tenancy Rules

### 1.1 Core Database Design Decisions
1. **UUID v4 Primary Keys (`gen_random_uuid()`):** Every table uses 128-bit `UUID` primary keys instead of auto-incrementing integers (`1, 2, 3...`). This prevents malicious users from guessing another member's project ID, render ID, or scheduled post ID in URLs or API requests.
2. **Strict Multi-Tenant Ownership (`user_id` Isolation):**
   * Every member owns their private rows across `brand_kits`, `projects`, `renders`, `instagram_accounts`, `scheduled_posts`, and `credit_ledger`.
   * Foreign keys enforce `ON DELETE CASCADE` so deleting a user or project cleanly removes all dependent rows without orphaned records.
3. **Hybrid Relational + Validated `JSONB` Pattern:**
   * **Relational Columns:** High-cardinality query/filter fields (`id`, `user_id`, `project_id`, `order_index`, `scene_type`, `status`, `scheduled_for`, `aspect_ratio`, `target_duration_sec`) are stored as standard typed PostgreSQL columns with B-Tree indexes.
   * **Structured `JSONB` Columns:** Variable template properties (`scenes.animation_props`), word-level TTS alignments (`scenes.word_timestamps`), subtitle styling (`projects.caption_config`), and audio mixing (`projects.bg_music_config`) use binary PostgreSQL `JSONB` validated at compile time by Go structs. This allows adding new animation templates in future versions with **zero `ALTER TABLE` migrations**.
4. **Timezone-Aware Timestamps (`TIMESTAMPTZ`):** All dates and scheduled post times are stored in UTC (`TIMESTAMP WITH TIME ZONE`) alongside the member's IANA timezone string (e.g., `"Asia/Kolkata"`) so the 60-second Go Cron Scheduler triggers accurately across global timezones.

---

## 2. Complete Entity-Relationship Diagram (ERD)

```mermaid
erDiagram
    USERS ||--|| BRAND_KITS : "1:1 owns (user_id)"
    USERS ||--o| INSTAGRAM_ACCOUNTS : "1:1 connects (user_id)"
    USERS ||--o{ PROJECTS : "1:N creates (user_id)"
    USERS ||--o{ RENDERS : "1:N triggers (user_id)"
    USERS ||--o{ SCHEDULED_POSTS : "1:N schedules (user_id)"
    USERS ||--o{ CREDIT_LEDGER : "1:N audits (user_id)"

    PROJECTS ||--|{ SCENES : "1:N contains (project_id)"
    PROJECTS ||--o{ RENDERS : "1:N exports (project_id)"
    PROJECTS ||--o{ SCHEDULED_POSTS : "1:N publishes (project_id)"

    RENDERS ||--o{ SCHEDULED_POSTS : "1:N attaches_mp4 (render_id)"
    INSTAGRAM_ACCOUNTS ||--o{ SCHEDULED_POSTS : "1:N targets_account (instagram_account_id)"

    USERS {
        uuid id PK "gen_random_uuid()"
        varchar(255) email UK "NOT NULL, Lowercase Unique"
        varchar(255) password_hash "NOT NULL, bcrypt cost 12"
        varchar(120) name "NOT NULL"
        int credit_balance "NOT NULL, DEFAULT 15, CHECK >= 0"
        timestamptz created_at "NOT NULL, DEFAULT NOW()"
        timestamptz updated_at "NOT NULL, DEFAULT NOW()"
    }

    BRAND_KITS {
        uuid id PK "gen_random_uuid()"
        uuid user_id FK_UK "UNIQUE, REFERENCES users(id) ON DELETE CASCADE"
        varchar(20) primary_color "NOT NULL, DEFAULT '#6366F1'"
        varchar(20) accent_color "NOT NULL, DEFAULT '#F59E0B'"
        varchar(80) font_family "NOT NULL, DEFAULT 'Inter'"
        varchar(40) default_voice_provider "NOT NULL, DEFAULT 'edge_tts'"
        varchar(100) default_voice_id "NOT NULL, DEFAULT 'en-US-ChristopherNeural'"
        text logo_url "DEFAULT ''"
        timestamptz updated_at "NOT NULL, DEFAULT NOW()"
    }

    PROJECTS {
        uuid id PK "gen_random_uuid()"
        uuid user_id FK "NOT NULL, REFERENCES users(id) ON DELETE CASCADE"
        varchar(255) title "NOT NULL"
        text topic_prompt "NOT NULL"
        varchar(60) category_preset "NOT NULL (technical_explainer | kids_learning | myth_vs_fact | data_stats | illustrated_story)"
        int target_duration_sec "NOT NULL, DEFAULT 60 (30 | 60 | 90)"
        varchar(10) aspect_ratio "NOT NULL, DEFAULT '9:16' ('9:16' | '16:9')"
        varchar(60) visual_style "NOT NULL, DEFAULT 'dark_tech'"
        varchar(40) voice_provider "NOT NULL, DEFAULT 'edge_tts' ('edge_tts' | 'elevenlabs')"
        varchar(100) voice_id "NOT NULL, DEFAULT 'en-US-ChristopherNeural'"
        float4 voice_speed "NOT NULL, DEFAULT 1.0"
        varchar(40) status "NOT NULL, DEFAULT 'draft' (draft | generating_assets | ready | rendering | rendered)"
        jsonb caption_config "NOT NULL, Subtitle style, colors & placement"
        jsonb bg_music_config "NOT NULL, Track ID & ducking volume"
        timestamptz created_at "NOT NULL, DEFAULT NOW()"
        timestamptz updated_at "NOT NULL, DEFAULT NOW()"
    }

    SCENES {
        uuid id PK "gen_random_uuid()"
        uuid project_id FK "NOT NULL, REFERENCES projects(id) ON DELETE CASCADE"
        int order_index "NOT NULL (1..15)"
        varchar(50) scene_type "NOT NULL (kids_counting | diagram_flow | split_comparison | stat_counter | illustrated_motion)"
        text narration_text "NOT NULL"
        varchar(255) on_screen_headline "NOT NULL"
        text visual_prompt "DEFAULT ''"
        jsonb animation_props "NOT NULL, Typed props for the 5 animation templates"
        text voiceover_url "DEFAULT ''"
        text image_url "DEFAULT ''"
        jsonb word_timestamps "NOT NULL, [{word, start_ms, end_ms}]"
        int duration_ms "NOT NULL, DEFAULT 5500"
        timestamptz created_at "NOT NULL, DEFAULT NOW()"
        timestamptz updated_at "NOT NULL, DEFAULT NOW()"
    }

    RENDERS {
        uuid id PK "gen_random_uuid()"
        uuid project_id FK "NOT NULL, REFERENCES projects(id) ON DELETE CASCADE"
        uuid user_id FK "NOT NULL, REFERENCES users(id) ON DELETE CASCADE"
        varchar(10) aspect_ratio "NOT NULL ('9:16' | '16:9')"
        varchar(40) status "NOT NULL (queued | rendering | completed | failed)"
        int progress_pct "NOT NULL, DEFAULT 0 (0..100)"
        varchar(255) current_step "DEFAULT ''"
        text output_mp4_url "DEFAULT ''"
        text cover_image_url "DEFAULT ''"
        int duration_ms "NOT NULL, DEFAULT 0"
        int credits_charged "NOT NULL, DEFAULT 1"
        text error_message "DEFAULT ''"
        timestamptz created_at "NOT NULL, DEFAULT NOW()"
        timestamptz completed_at "NULL"
    }

    INSTAGRAM_ACCOUNTS {
        uuid id PK "gen_random_uuid()"
        uuid user_id FK_UK "UNIQUE, REFERENCES users(id) ON DELETE CASCADE"
        varchar(100) ig_user_id "NOT NULL"
        varchar(120) ig_username "NOT NULL"
        varchar(40) account_type "NOT NULL, DEFAULT 'CREATOR' (CREATOR | BUSINESS)"
        text profile_pic_url "DEFAULT ''"
        text encrypted_access_token "NOT NULL, AES-256-GCM encrypted 60-day token"
        timestamptz token_expires_at "NOT NULL"
        boolean is_sandbox_mock "NOT NULL, DEFAULT false"
        varchar(40) status "NOT NULL, DEFAULT 'active' (active | expired | disconnected)"
        timestamptz created_at "NOT NULL, DEFAULT NOW()"
        timestamptz updated_at "NOT NULL, DEFAULT NOW()"
    }

    SCHEDULED_POSTS {
        uuid id PK "gen_random_uuid()"
        uuid user_id FK "NOT NULL, REFERENCES users(id) ON DELETE CASCADE"
        uuid project_id FK "NOT NULL, REFERENCES projects(id) ON DELETE CASCADE"
        uuid render_id FK "NOT NULL, REFERENCES renders(id) ON DELETE CASCADE"
        uuid instagram_account_id FK "NOT NULL, REFERENCES instagram_accounts(id) ON DELETE CASCADE"
        text caption "NOT NULL"
        text cover_image_url "DEFAULT ''"
        timestamptz scheduled_for "NOT NULL"
        varchar(80) timezone "NOT NULL, DEFAULT 'UTC'"
        varchar(40) status "NOT NULL (scheduled | creating_container | polling_container | publishing_reel | published | failed | cancelled)"
        varchar(120) ig_container_id "DEFAULT ''"
        varchar(120) ig_media_id "DEFAULT ''"
        text ig_permalink "DEFAULT ''"
        int retry_count "NOT NULL, DEFAULT 0"
        text last_error "DEFAULT ''"
        timestamptz published_at "NULL"
        timestamptz created_at "NOT NULL, DEFAULT NOW()"
        timestamptz updated_at "NOT NULL, DEFAULT NOW()"
    }

    CREDIT_LEDGER {
        uuid id PK "gen_random_uuid()"
        uuid user_id FK "NOT NULL, REFERENCES users(id) ON DELETE CASCADE"
        uuid project_id FK "NULL, REFERENCES projects(id) ON DELETE SET NULL"
        uuid render_id FK "NULL, REFERENCES renders(id) ON DELETE SET NULL"
        int delta "NOT NULL (+15 grant, -1/-2/-3 render deduction)"
        int balance_after "NOT NULL"
        varchar(120) reason "NOT NULL (starter_grant | render_30s | render_60s | render_90s | refund_failed_render)"
        timestamptz created_at "NOT NULL, DEFAULT NOW()"
    }
```

---

## 3. Detailed Table-by-Table Schema Dictionary (All 8 Tables)

### 3.1 Table 1: `users` (Member Accounts & Credit Balances)
Stores every registered member on Animora Studio. Used by **Page 2 (`/signup`)**, **Page 3 (`/login`)**, **Page 4 (`/dashboard`)**, and **Page 10 (`/settings`)**.

| Column | Postgres Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique member identifier embedded in JWT `sub` claim. |
| `email` | `VARCHAR(255)` | `NOT NULL UNIQUE` | Member's login email (normalized to lowercase). |
| `password_hash` | `VARCHAR(255)` | `NOT NULL` | `bcrypt` password hash (cost factor = 12). Never serialized to JSON (`json:"-"`). |
| `name` | `VARCHAR(120)` | `NOT NULL` | Member's display name shown in the dashboard header. |
| `credit_balance` | `INTEGER` | `NOT NULL DEFAULT 15 CHECK (credit_balance >= 0)` | Current available video credits (`30s = 1`, `60s = 2`, `90s = 3`). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Account creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last profile or balance update timestamp. |

---

### 3.2 Table 2: `brand_kits` (Per-Member Default Brand Styling & Voice Preferences)
Strict `1:1` relationship with `users`. Automatically created during `/auth/register` and editable on **Page 10 (`/dashboard/settings`)**.

| Column | Postgres Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Brand Kit primary key. |
| `user_id` | `UUID` | `NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE` | Owning member (`1:1` unique constraint). |
| `primary_color` | `VARCHAR(20)` | `NOT NULL DEFAULT '#6366F1'` | Default brand primary hex color for headers & diagram borders. |
| `accent_color` | `VARCHAR(20)` | `NOT NULL DEFAULT '#F59E0B'` | Default brand accent hex color for active nodes & karaoke subtitle highlights. |
| `font_family` | `VARCHAR(80)` | `NOT NULL DEFAULT 'Inter'` | Default typography (`Inter`, `Fredoka`, `Montserrat`, `JetBrains Mono`). |
| `default_voice_provider`| `VARCHAR(40)` | `NOT NULL DEFAULT 'edge_tts'` | Default TTS engine (`'edge_tts'` Free Unlimited or `'elevenlabs'`). |
| `default_voice_id` | `VARCHAR(100)` | `NOT NULL DEFAULT 'en-US-ChristopherNeural'`| Default voice persona ID (`en-US-AnaNeural`, `en-US-ChristopherNeural`, etc.). |
| `logo_url` | `TEXT` | `NOT NULL DEFAULT ''` | Optional corner brand logo / watermark image URL. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last update timestamp. |

---

### 3.3 Table 3: `projects` (Video Projects & Global Composition Settings)
Stores each video project created by a member on **Page 5 (`/dashboard/create`)** and edited in **Page 6 (`/studio`)**.

| Column | Postgres Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Unique video project ID. |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owning member (`WHERE user_id = ?` enforced on every query). |
| `title` | `VARCHAR(255)` | `NOT NULL` | Editable project title. |
| `topic_prompt` | `TEXT` | `NOT NULL` | Original brainstormed idea or custom topic prompt. |
| `category_preset` | `VARCHAR(60)` | `NOT NULL DEFAULT 'technical_explainer'` | `'technical_explainer'`, `'kids_learning'`, `'myth_vs_fact'`, `'data_stats'`, or `'illustrated_story'`. |
| `target_duration_sec` | `INTEGER` | `NOT NULL DEFAULT 60 CHECK (target_duration_sec IN (30, 60, 90))` | Target video duration (`30`, `60`, or `90` seconds). |
| `aspect_ratio` | `VARCHAR(10)` | `NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '16:9'))` | `'9:16'` (1080×1920 Vertical Reel) or `'16:9'` (1920×1080 Landscape). |
| `visual_style` | `VARCHAR(60)` | `NOT NULL DEFAULT 'dark_tech'` | `'dark_tech'`, `'flat_vector'`, `'pixar_3d'`, or `'whiteboard'`. |
| `voice_provider` | `VARCHAR(40)` | `NOT NULL DEFAULT 'edge_tts'` | `'edge_tts'` or `'elevenlabs'`. |
| `voice_id` | `VARCHAR(100)` | `NOT NULL DEFAULT 'en-US-ChristopherNeural'`| Selected voice persona for this project. |
| `voice_speed` | `REAL` | `NOT NULL DEFAULT 1.0` | Speaking speed multiplier (`0.85` to `1.20`). |
| `status` | `VARCHAR(40)` | `NOT NULL DEFAULT 'draft'` | `'draft'`, `'generating_assets'`, `'ready'`, `'rendering'`, `'rendered'`. |
| `caption_config` | `JSONB` | `NOT NULL` | Stores `CaptionConfig` (`enabled`, `style`, `font_family`, `text_color`, `highlight_color`, `position`). |
| `bg_music_config` | `JSONB` | `NOT NULL` | Stores `BgMusicConfig` (`track_id`, `volume`, `ducking_enabled`). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Project creation time. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last storyboard or setting edit time. |

---

### 3.4 Table 4: `scenes` (Ordered Storyboard Scenes, Animation Props & Word Timestamps)
Stores the **6 to 15 ordered scenes** belonging to a `project`.

| Column | Postgres Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Scene primary key (`scene_id` in JSON). |
| `project_id` | `UUID` | `NOT NULL REFERENCES projects(id) ON DELETE CASCADE` | Parent project ID. |
| `order_index` | `INTEGER` | `NOT NULL` | 1-based playback sequence (`1, 2, ..., N`). |
| `scene_type` | `VARCHAR(50)` | `NOT NULL` | One of the 5 templates: `'kids_counting'`, `'diagram_flow'`, `'split_comparison'`, `'stat_counter'`, `'illustrated_motion'`. |
| `narration_text` | `TEXT` | `NOT NULL` | Spoken voiceover script for this scene. |
| `on_screen_headline` | `VARCHAR(255)` | `NOT NULL` | Top stage title banner displayed in the scene. |
| `visual_prompt` | `TEXT` | `NOT NULL DEFAULT ''` | Prompt used for AI illustration generation (when applicable). |
| `animation_props` | `JSONB` | `NOT NULL` | Validated template properties (`KidsCountingProps`, `DiagramFlowProps`, `SplitComparisonProps`, `StatCounterProps`, or `IllustratedMotionProps`). |
| `voiceover_url` | `TEXT` | `NOT NULL DEFAULT ''` | Public/static URL to the synthesized `.mp3` voiceover for this scene. |
| `image_url` | `TEXT` | `NOT NULL DEFAULT ''` | Optional generated illustration URL. |
| `word_timestamps` | `JSONB` | `NOT NULL DEFAULT '[]'::jsonb` | Array of `[{ "word": "Sunlight", "start_ms": 120, "end_ms": 540 }]` used for word-by-word subtitles and counting pop-ins. |
| `duration_ms` | `INTEGER` | `NOT NULL DEFAULT 5500` | Exact scene duration in milliseconds (`last_word_end_ms + 450ms`). |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Creation timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last edit timestamp. |

---

### 3.5 Table 5: `renders` (1080p MP4 Video Export Jobs)
Tracks every final `.mp4` render triggered by a member on **Page 6 (`/studio`)** or **Page 7 (`/publish`)**.

| Column | Postgres Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Render job ID (`render_id`). |
| `project_id` | `UUID` | `NOT NULL REFERENCES projects(id) ON DELETE CASCADE` | Source project ID. |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owning member ID. |
| `aspect_ratio` | `VARCHAR(10)` | `NOT NULL` | `'9:16'` (1080×1920) or `'16:9'` (1920×1080). |
| `status` | `VARCHAR(40)` | `NOT NULL DEFAULT 'queued'` | `'queued'`, `'rendering'`, `'completed'`, `'failed'`. |
| `progress_pct` | `INTEGER` | `NOT NULL DEFAULT 0` | Live render progress (`0` to `100`). |
| `current_step` | `VARCHAR(255)` | `NOT NULL DEFAULT ''` | Human-readable step label streamed via SSE. |
| `output_mp4_url` | `TEXT` | `NOT NULL DEFAULT ''` | Public HTTPS `.mp4` URL (used for browser download & Instagram Graph API `video_url`). |
| `cover_image_url` | `TEXT` | `NOT NULL DEFAULT ''` | Public HTTPS thumbnail image URL for the Reel cover. |
| `duration_ms` | `INTEGER` | `NOT NULL DEFAULT 0` | Total rendered video duration in milliseconds. |
| `credits_charged` | `INTEGER` | `NOT NULL DEFAULT 1` | Credits deducted for this render (`1`, `2`, or `3`). |
| `error_message` | `TEXT` | `NOT NULL DEFAULT ''` | Populated if `status == 'failed'`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Render start time. |
| `completed_at` | `TIMESTAMPTZ` | `NULL` | Render completion time. |

---

### 3.6 Table 6: `instagram_accounts` (Per-Member Connected Instagram Account & Encrypted Token Vault)
Strict `1:1` per-member table storing each member's own connected Instagram Professional (Creator/Business) account on **Page 9 (`/dashboard/integrations`)**.

| Column | Postgres Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Record ID. |
| `user_id` | `UUID` | `NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE` | Ensures each member has their own private Instagram connection (`1:1`). |
| `ig_user_id` | `VARCHAR(100)` | `NOT NULL` | Meta Graph API Instagram Professional User ID (e.g., `"17841405822304914"`). |
| `ig_username` | `VARCHAR(120)` | `NOT NULL` | Member's Instagram handle (e.g., `"rohan_explains"`). |
| `account_type` | `VARCHAR(40)` | `NOT NULL DEFAULT 'CREATOR'` | `'CREATOR'` or `'BUSINESS'`. |
| `profile_pic_url` | `TEXT` | `NOT NULL DEFAULT ''` | Member's IG avatar URL. |
| `encrypted_access_token`| `TEXT` | `NOT NULL` | **AES-256-GCM encrypted** 60-day Meta Long-Lived OAuth Token (`base64(nonce + ciphertext + tag)`). |
| `token_expires_at` | `TIMESTAMPTZ` | `NOT NULL` | Token expiration timestamp (auto-refreshed by background worker when $< 7$ days remain). |
| `is_sandbox_mock` | `BOOLEAN` | `NOT NULL DEFAULT FALSE` | `true` when using Sandbox Mock Mode for local testing without live Meta App Review. |
| `status` | `VARCHAR(40)` | `NOT NULL DEFAULT 'active'` | `'active'`, `'expired'`, or `'disconnected'`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Initial connection timestamp. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last token refresh timestamp. |

---

### 3.7 Table 7: `scheduled_posts` (Content Calendar & Instagram Publishing Queue)
Powers both **1-Click "Post Now"** (`scheduled_for = NOW()`) on **Page 7 (`/publish`)** and **Scheduled Calendar Posts** on **Page 8 (`/dashboard/calendar`)**.

| Column | Postgres Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Scheduled post ID. |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owning member ID. |
| `project_id` | `UUID` | `NOT NULL REFERENCES projects(id) ON DELETE CASCADE` | Associated project ID. |
| `render_id` | `UUID` | `NOT NULL REFERENCES renders(id) ON DELETE CASCADE` | The rendered `.mp4` video being published. |
| `instagram_account_id` | `UUID` | `NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE`| The member's target Instagram account. |
| `caption` | `TEXT` | `NOT NULL` | Final Instagram Reel post caption & hashtags (`max 2,200 chars`). |
| `cover_image_url` | `TEXT` | `NOT NULL DEFAULT ''` | Optional Reel cover frame URL. |
| `scheduled_for` | `TIMESTAMPTZ` | `NOT NULL` | Target publish timestamp (polled every 60s by the Go Cron Scheduler). |
| `timezone` | `VARCHAR(80)` | `NOT NULL DEFAULT 'UTC'` | Member's display timezone (e.g., `'Asia/Kolkata'`). |
| `status` | `VARCHAR(40)` | `NOT NULL DEFAULT 'scheduled'` | `'scheduled'`, `'creating_container'`, `'polling_container'`, `'publishing_reel'`, `'published'`, `'failed'`, `'cancelled'`. |
| `ig_container_id` | `VARCHAR(120)` | `NOT NULL DEFAULT ''` | Meta Graph API media container `creation_id`. |
| `ig_media_id` | `VARCHAR(120)` | `NOT NULL DEFAULT ''` | Published Instagram Reel `media_id`. |
| `ig_permalink` | `TEXT` | `NOT NULL DEFAULT ''` | Live Instagram Reel URL (e.g., `https://www.instagram.com/reel/...`). |
| `retry_count` | `INTEGER` | `NOT NULL DEFAULT 0` | Automatic retry counter (`0..3`). |
| `last_error` | `TEXT` | `NOT NULL DEFAULT ''` | Last error detail if a publish attempt failed. |
| `published_at` | `TIMESTAMPTZ` | `NULL` | Exact timestamp when the Reel went live on Instagram. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Schedule creation time. |
| `updated_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Last state transition time. |

---

### 3.8 Table 8: `credit_ledger` (Immutable Audit Trail of Video Credits)
Records every credit grant and deduction for **Page 10 (`/dashboard/settings` — Credits & Usage History)**.

| Column | Postgres Type | Constraints & Defaults | Description |
| :--- | :--- | :--- | :--- |
| `id` | `UUID` | `PRIMARY KEY DEFAULT gen_random_uuid()` | Ledger entry ID. |
| `user_id` | `UUID` | `NOT NULL REFERENCES users(id) ON DELETE CASCADE` | Owning member ID. |
| `project_id` | `UUID` | `NULL REFERENCES projects(id) ON DELETE SET NULL` | Associated project (if deduction/refund). |
| `render_id` | `UUID` | `NULL REFERENCES renders(id) ON DELETE SET NULL` | Associated render job (if deduction/refund). |
| `delta` | `INTEGER` | `NOT NULL` | Signed credit change (`+15` starter grant, `-1` for 30s, `-2` for 60s, `-3` for 90s, or `+2` refund on failed render). |
| `balance_after` | `INTEGER` | `NOT NULL` | Member's resulting `credit_balance` after this transaction. |
| `reason` | `VARCHAR(120)` | `NOT NULL` | `'starter_grant'`, `'render_30s'`, `'render_60s'`, `'render_90s'`, `'refund_failed_render'`. |
| `created_at` | `TIMESTAMPTZ` | `NOT NULL DEFAULT NOW()` | Transaction timestamp. |

---

## 4. Complete Production PostgreSQL DDL Script (`schema.sql`)

While Go `GORM` automatically runs `db.AutoMigrate(...)` on startup, here is the exact PostgreSQL DDL specification including all constraints and performance indexes:

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. USERS
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    name VARCHAR(120) NOT NULL,
    credit_balance INTEGER NOT NULL DEFAULT 15 CHECK (credit_balance >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. BRAND KITS (1:1 per User)
CREATE TABLE IF NOT EXISTS brand_kits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    primary_color VARCHAR(20) NOT NULL DEFAULT '#6366F1',
    accent_color VARCHAR(20) NOT NULL DEFAULT '#F59E0B',
    font_family VARCHAR(80) NOT NULL DEFAULT 'Inter',
    default_voice_provider VARCHAR(40) NOT NULL DEFAULT 'edge_tts',
    default_voice_id VARCHAR(100) NOT NULL DEFAULT 'en-US-ChristopherNeural',
    logo_url TEXT NOT NULL DEFAULT '',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    topic_prompt TEXT NOT NULL,
    category_preset VARCHAR(60) NOT NULL DEFAULT 'technical_explainer',
    target_duration_sec INTEGER NOT NULL DEFAULT 60 CHECK (target_duration_sec IN (30, 60, 90)),
    aspect_ratio VARCHAR(10) NOT NULL DEFAULT '9:16' CHECK (aspect_ratio IN ('9:16', '16:9')),
    visual_style VARCHAR(60) NOT NULL DEFAULT 'dark_tech',
    voice_provider VARCHAR(40) NOT NULL DEFAULT 'edge_tts',
    voice_id VARCHAR(100) NOT NULL DEFAULT 'en-US-ChristopherNeural',
    voice_speed REAL NOT NULL DEFAULT 1.0,
    status VARCHAR(40) NOT NULL DEFAULT 'draft',
    caption_config JSONB NOT NULL DEFAULT '{"enabled":true,"style":"karaoke_highlight","font_family":"Inter","text_color":"#FFFFFF","highlight_color":"#FBBF24","position":"bottom_safe"}'::jsonb,
    bg_music_config JSONB NOT NULL DEFAULT '{"track_id":"ambient_science","volume":0.12,"ducking_enabled":true}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_user_created ON projects(user_id, created_at DESC);

-- 4. SCENES
CREATE TABLE IF NOT EXISTS scenes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    order_index INTEGER NOT NULL,
    scene_type VARCHAR(50) NOT NULL CHECK (scene_type IN ('kids_counting', 'diagram_flow', 'split_comparison', 'stat_counter', 'illustrated_motion')),
    narration_text TEXT NOT NULL,
    on_screen_headline VARCHAR(255) NOT NULL,
    visual_prompt TEXT NOT NULL DEFAULT '',
    animation_props JSONB NOT NULL DEFAULT '{}'::jsonb,
    voiceover_url TEXT NOT NULL DEFAULT '',
    image_url TEXT NOT NULL DEFAULT '',
    word_timestamps JSONB NOT NULL DEFAULT '[]'::jsonb,
    duration_ms INTEGER NOT NULL DEFAULT 5500,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_scenes_project_order ON scenes(project_id, order_index ASC);

-- 5. RENDERS
CREATE TABLE IF NOT EXISTS renders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    aspect_ratio VARCHAR(10) NOT NULL,
    status VARCHAR(40) NOT NULL DEFAULT 'queued',
    progress_pct INTEGER NOT NULL DEFAULT 0,
    current_step VARCHAR(255) NOT NULL DEFAULT '',
    output_mp4_url TEXT NOT NULL DEFAULT '',
    cover_image_url TEXT NOT NULL DEFAULT '',
    duration_ms INTEGER NOT NULL DEFAULT 0,
    credits_charged INTEGER NOT NULL DEFAULT 1,
    error_message TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_renders_project_created ON renders(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_renders_user_created ON renders(user_id, created_at DESC);

-- 6. INSTAGRAM ACCOUNTS (1:1 per User)
CREATE TABLE IF NOT EXISTS instagram_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    ig_user_id VARCHAR(100) NOT NULL,
    ig_username VARCHAR(120) NOT NULL,
    account_type VARCHAR(40) NOT NULL DEFAULT 'CREATOR',
    profile_pic_url TEXT NOT NULL DEFAULT '',
    encrypted_access_token TEXT NOT NULL,
    token_expires_at TIMESTAMPTZ NOT NULL,
    is_sandbox_mock BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(40) NOT NULL DEFAULT 'active',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. SCHEDULED POSTS (Content Calendar & Cron Queue)
CREATE TABLE IF NOT EXISTS scheduled_posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    render_id UUID NOT NULL REFERENCES renders(id) ON DELETE CASCADE,
    instagram_account_id UUID NOT NULL REFERENCES instagram_accounts(id) ON DELETE CASCADE,
    caption TEXT NOT NULL,
    cover_image_url TEXT NOT NULL DEFAULT '',
    scheduled_for TIMESTAMPTZ NOT NULL,
    timezone VARCHAR(80) NOT NULL DEFAULT 'UTC',
    status VARCHAR(40) NOT NULL DEFAULT 'scheduled',
    ig_container_id VARCHAR(120) NOT NULL DEFAULT '',
    ig_media_id VARCHAR(120) NOT NULL DEFAULT '',
    ig_permalink TEXT NOT NULL DEFAULT '',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT NOT NULL DEFAULT '',
    published_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Partial Index for the 60-Second Go Cron Worker polling due scheduled posts
CREATE INDEX IF NOT EXISTS idx_scheduled_posts_due_cron
    ON scheduled_posts(scheduled_for ASC)
    WHERE status = 'scheduled';

CREATE INDEX IF NOT EXISTS idx_scheduled_posts_user_calendar
    ON scheduled_posts(user_id, scheduled_for DESC);

-- 8. CREDIT LEDGER
CREATE TABLE IF NOT EXISTS credit_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    project_id UUID NULL REFERENCES projects(id) ON DELETE SET NULL,
    render_id UUID NULL REFERENCES renders(id) ON DELETE SET NULL,
    delta INTEGER NOT NULL,
    balance_after INTEGER NOT NULL,
    reason VARCHAR(120) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_credit_ledger_user_created ON credit_ledger(user_id, created_at DESC);
```

---

## 5. Critical Database Transactions & Concurrency Patterns in Go (`GORM`)

### 5.1 Transaction 1: Atomic Member Signup (`users` + `brand_kits` + `credit_ledger`)
When a new member signs up on `/signup`, all 3 tables are initialized in one atomic `db.Transaction`:
```go
err := db.Transaction(func(tx *gorm.DB) error {
    // 1. Insert User with 15 starter credits
    if err := tx.Create(&user).Error; err != nil {
        return err
    }
    // 2. Initialize Member's Private Brand Kit
    brandKit := models.BrandKit{
        UserID:               user.ID,
        PrimaryColor:         "#6366F1",
        AccentColor:          "#F59E0B",
        FontFamily:           "Inter",
        DefaultVoiceProvider: "edge_tts",
        DefaultVoiceID:       "en-US-ChristopherNeural",
    }
    if err := tx.Create(&brandKit).Error; err != nil {
        return err
    }
    // 3. Record +15 Starter Grant in Credit Ledger
    ledger := models.CreditLedger{
        UserID:       user.ID,
        Delta:        15,
        BalanceAfter: 15,
        Reason:       "starter_grant",
    }
    return tx.Create(&ledger).Error
})
```

### 5.2 Transaction 2: Race-Condition-Free Credit Deduction on MP4 Render
To prevent a member from clicking "Render MP4" twice in parallel and spending credits they don't have, we lock the user row with `clause.Locking{Strength: "UPDATE"}`:
```go
err := db.Transaction(func(tx *gorm.DB) error {
    var user models.User
    if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
        First(&user, "id = ?", userID).Error; err != nil {
        return err
    }

    cost := CalculateCreditCost(project.TargetDurationSec) // 30s->1, 60s->2, 90s->3
    if user.CreditBalance < cost {
        return ErrInsufficientCredits
    }

    user.CreditBalance -= cost
    if err := tx.Save(&user).Error; err != nil {
        return err
    }

    if err := tx.Create(&renderJob).Error; err != nil {
        return err
    }

    return tx.Create(&models.CreditLedger{
        UserID:       user.ID,
        ProjectID:    &project.ID,
        RenderID:     &renderJob.ID,
        Delta:        -cost,
        BalanceAfter: user.CreditBalance,
        Reason:       fmt.Sprintf("render_%ds", project.TargetDurationSec),
    }).Error
})
```
*(Note: If the background MP4 render fails due to an internal error, a compensating transaction automatically refunds `+cost` back to `user.CreditBalance` and logs `"refund_failed_render"` in `credit_ledger`!)*

### 5.3 Transaction 3: Crash-Safe 60-Second Cron Job Claiming (`FOR UPDATE SKIP LOCKED`)
Every 60 seconds, the Go scheduler safely claims due Instagram Reels without duplicate publishing:
```go
var duePosts []models.ScheduledPost
err := db.Transaction(func(tx *gorm.DB) error {
    if err := tx.Clauses(clause.Locking{
        Strength: "UPDATE",
        Options:  "SKIP LOCKED",
    }).Where("status = ? AND scheduled_for <= ?", "scheduled", time.Now().UTC()).
        Order("scheduled_for ASC").
        Limit(5).
        Find(&duePosts).Error; err != nil {
        return err
    }

    for i := range duePosts {
        duePosts[i].Status = "creating_container"
        if err := tx.Save(&duePosts[i]).Error; err != nil {
            return err
        }
    }
    return nil
})
```
