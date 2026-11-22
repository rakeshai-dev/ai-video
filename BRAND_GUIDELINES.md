# Brand & Design System Guidelines: Animora Studio
**Product Name:** Animora Studio — AI Educational & Animated Video SaaS Platform  
**Design Philosophy:** Minimalist • Creative • Futuristic Studio Hardware • Zero "AI Slop"  

---

## 1. The Anti-"AI Slop" Manifesto (Our Core Visual Rules)

To ensure **Animora Studio** looks like a world-class creative studio tool (on the level of **Linear, Runway, Frame.io, Raycast, and Teenage Engineering**) rather than a generic AI template:

| What Generic "AI Slop" Websites Do (❌ BANNED) | What Animora Studio Does Instead (✅ REQUIRED) |
| :--- | :--- |
| Overused neon purple-to-pink-to-cyan gradients on every button and heading | **85% Matte Architectural Neutrals + 15% Precision Vibrant Accent** (solid high-contrast primary buttons with crisp micro-borders) |
| Giant blurry glowing blobs floating behind every section | **Tactile Studio Geometry:** Subtle `1px` architectural gridlines, dot-matrix canvas textures, and real interactive video timeline previews |
| Thick glowing 2px borders and cartoonish drop shadows | **Razor-Thin `1px` Hairline Borders** (`rgba(255,255,255,0.08)` in dark or `#E4E4E0` in light) with subtle inner highlights |
| Generic default fonts with loose letter spacing | **Editorial Display + Technical Monospace Pairing:** Tight geometric headings (`-0.03em` tracking) paired with crisp monospace timecodes (`00:45.12 • 9:16 • 60FPS`) |

---

## 2. The 4 Brand Direction Options (Pick One to Lock In)

### Direction A: "Obsidian Cinema & Electric Vermilion" *(Recommended)*
* **Inspiration:** Runway Gen-3, Frame.io, Teenage Engineering
* **Personality:** A futuristic dark-room video studio. Deep matte carbon surfaces keep the eyes rested while editing video, while **Electric Vermilion (`#FF4F28`)** and **Solar Amber (`#F59E0B`)** bring warmth, creativity, and energy without looking noisy.
* **Color Tokens:**
  * `--bg-canvas`: `#09090B` (Deep Zinc Carbon)
  * `--bg-surface`: `#121216` (Matte Studio Graphite)
  * `--bg-elevated`: `#18181D` (Inspector & Card Hover)
  * `--border-hairline`: `#27272A` (`1px solid`)
  * `--brand-primary`: `#FF4F28` (Electric Vermilion — Primary CTAs & Active Playhead)
  * `--brand-accent`: `#F59E0B` (Solar Amber — Subtitle Highlights & Diagram Nodes)
  * `--status-live`: `#10B981` (Signal Jade — Connected IG & Render Complete)
  * `--text-primary`: `#FAFAFA` | `--text-muted`: `#A1A1AA`

---

### Direction B: "Nordic Emerald & Midnight Slate"
* **Inspiration:** Linear, Raycast, Supabase
* **Personality:** Calm, ultra-modern, high-precision engineering. Deep midnight slate paired with vibrant **Cyber Emerald (`#10B981`)** and **Sky Cyan (`#38BDF8`)**. Feels authoritative, clean, and distraction-free for educators and technical creators.
* **Color Tokens:**
  * `--bg-canvas`: `#070A0E` (Midnight Slate)
  * `--bg-surface`: `#0F141C` (Obsidian Panel)
  * `--bg-elevated`: `#161F2C`
  * `--border-hairline`: `#1E293B`
  * `--brand-primary`: `#10B981` (Precision Emerald)
  * `--brand-accent`: `#38BDF8` (Sky Cyan)
  * `--text-primary`: `#F8FAFC` | `--text-muted`: `#94A3B8`

---

### Direction C: "Editorial Daylight & Klein Cobalt"
* **Inspiration:** Notion, Figma, Vercel Light, Read.cv
* **Personality:** An airy, architectural **Light Mode** studio (with a high-contrast dark stage around the video player). Warm alabaster paper surfaces (`#FAF9F5`), deep ink-black typography (`#111113`), and vibrant **Klein Cobalt (`#2563EB`)** + **Creative Tangerine (`#F97316`)**. Immediately stands out from every dark-mode AI clone.
* **Color Tokens:**
  * `--bg-canvas`: `#FAF9F5` (Warm Editorial Alabaster)
  * `--bg-surface`: `#FFFFFF` (Pure Crisp Card)
  * `--bg-elevated`: `#F3F2EE` (Stone Well)
  * `--border-hairline`: `#E4E4E0`
  * `--brand-primary`: `#2563EB` (Klein Cobalt Blue)
  * `--brand-accent`: `#F97316` (Creative Tangerine)
  * `--text-primary`: `#111113` | `--text-muted`: `#64645E`

---

### Direction D: "Brushed Titanium & Acid Volt"
* **Inspiration:** Apple Pro Apps, MasterClass, Arc Studio
* **Personality:** Sleek luxury pro-creator aesthetic. Brushed titanium charcoal (`#0B0B0E`) paired with a punchy, futuristic **Chartreuse Acid Volt (`#D2F84C`)** primary button (with crisp black text `#09090B`) and **Royal Indigo (`#6366F1`)** secondary accents.
* **Color Tokens:**
  * `--bg-canvas`: `#0B0B0E` (Titanium Black)
  * `--bg-surface`: `#141419` (Brushed Steel)
  * `--bg-elevated`: `#1C1C24`
  * `--border-hairline`: `#282832`
  * `--brand-primary`: `#D2F84C` (Acid Volt)
  * `--brand-accent`: `#6366F1` (Studio Indigo)
  * `--text-primary`: `#F4F4F6` | `--text-muted`: `#8E8E9E`

---

## 3. Typography & Hierarchy System

We use a **3-Font Studio System** (loaded via `next/font/google` with zero layout shift):

1. **Display & Section Headings (`Space Grotesk` or `Plus Jakarta Sans`):**
   * Gives headlines a distinctive, modern architectural silhouette without feeling gimmicky.
   * **Hero H1:** `56px` (`3.5rem`), `font-weight: 700`, `line-height: 1.08`, `letter-spacing: -0.03em`
   * **Section H2:** `36px` (`2.25rem`), `font-weight: 700`, `line-height: 1.15`, `letter-spacing: -0.02em`
   * **Card H3:** `20px` (`1.25rem`), `font-weight: 600`, `letter-spacing: -0.01em`
2. **UI Controls & Long-Form Body (`Inter` / `Plus Jakarta Sans`):**
   * Maximum legibility at small sizes inside the 3-Column Storyboard Studio.
   * **Body Large:** `16px`, `line-height: 1.6`
   * **Studio UI Label:** `13px`, `font-weight: 500`
3. **Technical Metadata, Timecodes & Badges (`JetBrains Mono`):**
   * Used for scene numbers (`SCENE 03 / 08`), video duration (`00:58.4 / 01:00`), aspect ratio pills (`9:16 • 1080×1920`), credit counters (`15 CREDITS`), and status tags.
   * Always styled with `font-variant-numeric: tabular-nums`.

---

## 4. Layout, Geometry & Framer Motion Guidelines

* **Border Radius Scale:**
  * Outer Studio Containers & Video Stage: `16px` (`rounded-2xl`)
  * Storyboard Cards & Panels: `12px` (`rounded-xl`)
  * Buttons & Inputs: `8px` (`rounded-lg`)
  * Technical Status Pills: `9999px` (`rounded-full`)
* **Micro-Interactions (Framer Motion):**
  * Snappy spring physics (`type: "spring", stiffness: 380, damping: 30`)—never slow, sluggish fades.
  * Tactile timeline scrubbing and smooth layout morphing (`layoutId`) when switching tabs or aspect ratios (`9:16` $\leftrightarrow$ `16:9`).
