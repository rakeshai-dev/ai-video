import crypto from "node:crypto";
import { getDb } from "@/lib/db";

export type SceneType =
  | "kids_counting"
  | "diagram_flow"
  | "split_comparison"
  | "stat_counter"
  | "illustrated_motion";

export type SubtitleStyle =
  | "karaoke_highlight"
  | "hormozi_pop"
  | "kids_read_along"
  | "clean_minimal";

export interface WordTimestamp {
  word: string;
  start_ms: number;
  end_ms: number;
}

/**
 * Canonical SceneData contract matching `packages/video-engine/src/types/schema.ts` field-for-field
 * so Storyboard Studio (F-06) and Headless 1080p MP4 Renderer (F-07) share zero-translation JSON.
 */
export interface SceneData {
  scene_id: string;
  order_index: number;
  scene_type: SceneType;
  narration_text: string;
  on_screen_headline: string;
  visual_prompt?: string;
  animation_props: Record<string, unknown>;
  voiceover_url?: string;
  image_url?: string;
  word_timestamps: WordTimestamp[];
  duration_ms: number;
}

export interface VideoProjectSummary {
  id: string;
  userId: string;
  title: string;
  topicPrompt: string;
  aspectRatio: "9:16" | "16:9";
  durationSec: number;
  primaryTemplate: SceneType;
  voiceEngine: string;
  voiceId: string;
  subtitleStyle: SubtitleStyle;
  status: "draft" | "rendering" | "rendered" | "scheduled" | "published";
  scenesCount: number;
  mp4Path: string | null;
  createdAt: string;
  updatedAt: string;
}

export function generateEstimatedWordTimestamps(
  text: string,
  durationMs: number
): WordTimestamp[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const activeDuration = Math.max(1000, durationMs - 350);
  const totalChars = words.reduce((acc, w) => acc + w.length + 1, 0);
  let cursor = 120;

  return words.map((word) => {
    const share = (word.length + 1) / totalChars;
    const wordDur = Math.max(180, Math.round(share * activeDuration));
    const entry: WordTimestamp = {
      word,
      start_ms: cursor,
      end_ms: cursor + wordDur,
    };
    cursor += wordDur;
    return entry;
  });
}

export function buildDefaultAnimationProps(
  sceneType: SceneType,
  headline: string
): Record<string, unknown> {
  switch (sceneType) {
    case "kids_counting":
      return {
        mode: "counting",
        focus_symbol: "A • 5",
        phonetic_word: headline,
        target_count: 5,
        item_label: "Apples",
        item_emoji: "🍎",
        theme_palette: "playful",
        confetti_on_complete: true,
      };
    case "split_comparison":
      return {
        left_or_top_card: {
          badge_text: "✗ COMMON MYTH",
          title: "Outdated Assumption",
          points: ["High energy loss", "Fails under load"],
          color_hex: "#EF4444",
        },
        right_or_bottom_card: {
          badge_text: "✓ VERIFIED FACT",
          title: "Measured Reality",
          points: ["High efficiency", "Proven in field tests"],
          color_hex: "#10B981",
        },
      };
    case "stat_counter":
      return {
        display_mode: "bar_chart",
        target_number: 87,
        number_prefix: "+",
        number_suffix: "%",
        takeaway_label: headline,
        bars: [
          { label: "Baseline", value: 32, color_hex: "#64748B" },
          { label: "Standard", value: 54, color_hex: "#F59E0B" },
          { label: "Optimized", value: 87, color_hex: "#10B981" },
        ],
      };
    case "illustrated_motion":
      return {
        art_style: "dark_tech",
        camera_motion: "zoom_in",
        callout_badge: `✨ ${headline.slice(0, 28)}`,
      };
    case "diagram_flow":
    default:
      return {
        flow_direction: "auto",
        nodes: [
          { id: "n1", title: "1. Input Signal", subtitle: "Primary energy/data source", icon: "☀️" },
          { id: "n2", title: "2. Core Process", subtitle: "Active conversion stage", icon: "⚡" },
          { id: "n3", title: "3. Final Output", subtitle: "Delivered usable result", icon: "🚀" },
        ],
      };
  }
}

export function normalizeScenesJson(
  rawJson: string,
  fallbackTemplate: SceneType,
  fallbackTopic: string
): SceneData[] {
  try {
    const parsed = JSON.parse(rawJson);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item, idx) => {
      if (item && typeof item === "object" && "scene_id" in item && "scene_type" in item) {
        return item as SceneData;
      }
      // Transparently upgrade any legacy `{ id, title, template, narration, durationSec }` scene objects
      const sceneType = (item?.template || fallbackTemplate || "diagram_flow") as SceneType;
      const headline = String(item?.title || `Scene ${idx + 1}`);
      const narration = String(item?.narration || fallbackTopic);
      const durationMs = Math.max(3000, Number(item?.durationSec || 6) * 1000);
      return {
        scene_id: String(item?.id || `sc_${String(idx + 1).padStart(2, "0")}`),
        order_index: idx + 1,
        scene_type: sceneType,
        narration_text: narration,
        on_screen_headline: headline,
        animation_props: buildDefaultAnimationProps(sceneType, headline),
        word_timestamps: generateEstimatedWordTimestamps(narration, durationMs),
        duration_ms: durationMs,
      };
    });
  } catch {
    return [];
  }
}

/**
 * Seeds realistic sample projects ONCE for the pre-seeded demo creator accounts (`usr_demo_*`).
 * Uses `users.demo_seeded` so deleting all demo projects does not resurrect them on refresh.
 * Brand-new real users who sign up start with 0 projects for the First-Time Empty Onboarding state (`14A/B`).
 */
export function ensureDemoProjectsSeeded(userId: string) {
  if (!userId.startsWith("usr_demo_")) return;
  const db = getDb();

  const userRow = db
    .prepare("SELECT demo_seeded FROM users WHERE id = ?")
    .get(userId) as { demo_seeded: number } | undefined;

  if (!userRow || userRow.demo_seeded === 1) return;

  const countRow = db
    .prepare("SELECT COUNT(*) as cnt FROM video_projects WHERE user_id = ?")
    .get(userId) as { cnt: number };

  if (countRow.cnt > 0) {
    db.prepare("UPDATE users SET demo_seeded = 1 WHERE id = ?").run(userId);
    return;
  }

  const now = new Date();
  const iso = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString();

  const sampleProjects: Array<{
    id: string;
    title: string;
    topicPrompt: string;
    aspectRatio: "9:16" | "16:9";
    durationSec: number;
    primaryTemplate: SceneType;
    voiceEngine: string;
    voiceId: string;
    subtitleStyle: SubtitleStyle;
    status: VideoProjectSummary["status"];
    scenes: number;
    mp4Path: string | null;
    createdAt: string;
  }> =
    userId === "usr_demo_maya"
      ? [
          {
            id: `proj_${crypto.randomBytes(5).toString("hex")}`,
            title: "Kids Orchard Counting: 1 to 5 Apples & Letters A–E",
            topicPrompt: "Count 1 to 5 colorful apples and learn alphabet letters A through E with read-along highlights.",
            aspectRatio: "9:16",
            durationSec: 45,
            primaryTemplate: "kids_counting",
            voiceEngine: "edge_tts",
            voiceId: "en-US-AnaNeural",
            subtitleStyle: "kids_read_along",
            status: "rendered",
            scenes: 6,
            mp4Path: "/api/v1/video-file?name=prototype",
            createdAt: iso(4),
          },
          {
            id: `proj_${crypto.randomBytes(5).toString("hex")}`,
            title: "Count 1 to 5 Space Rockets & Phonics",
            topicPrompt: "Blast off with 5 animated rockets for preschool counting practice.",
            aspectRatio: "9:16",
            durationSec: 30,
            primaryTemplate: "kids_counting",
            voiceEngine: "edge_tts",
            voiceId: "en-US-AnaNeural",
            subtitleStyle: "kids_read_along",
            status: "draft",
            scenes: 5,
            mp4Path: null,
            createdAt: iso(18),
          },
        ]
      : [
          {
            id: `proj_${crypto.randomBytes(5).toString("hex")}`,
            title: "How Solar Panels Turn Sunlight Into Electricity",
            topicPrompt: "Explain the photovoltaic effect step-by-step from photons hitting silicon to 240V home AC.",
            aspectRatio: "9:16",
            durationSec: 65,
            primaryTemplate: "diagram_flow",
            voiceEngine: "edge_tts",
            voiceId: "en-US-ChristopherNeural",
            subtitleStyle: "karaoke_highlight",
            status: "rendered",
            scenes: 8,
            mp4Path: "/api/v1/video-file?name=solar",
            createdAt: iso(2),
          },
          {
            id: `proj_${crypto.randomBytes(5).toString("hex")}`,
            title: "Kids Orchard Counting: 1 to 5 Apples & Letters A-B-C",
            topicPrompt: "Playful bouncing apples & letters for early childhood learning.",
            aspectRatio: "9:16",
            durationSec: 45,
            primaryTemplate: "kids_counting",
            voiceEngine: "edge_tts",
            voiceId: "en-US-AnaNeural",
            subtitleStyle: "kids_read_along",
            status: "scheduled",
            scenes: 6,
            mp4Path: "/api/v1/video-file?name=prototype",
            createdAt: iso(9),
          },
          {
            id: `proj_${crypto.randomBytes(5).toString("hex")}`,
            title: "How REST APIs & JWT Authentication Work",
            topicPrompt: "Diagram client-server HTTP requests and stateless HMAC-SHA256 JWT verification.",
            aspectRatio: "16:9",
            durationSec: 90,
            primaryTemplate: "diagram_flow",
            voiceEngine: "edge_tts",
            voiceId: "en-US-ChristopherNeural",
            subtitleStyle: "clean_minimal",
            status: "draft",
            scenes: 12,
            mp4Path: null,
            createdAt: iso(20),
          },
          {
            id: `proj_${crypto.randomBytes(5).toString("hex")}`,
            title: "5 Myths vs. Facts About Electric Vehicles",
            topicPrompt: "Split-screen myth busting on EV battery degradation and winter range.",
            aspectRatio: "9:16",
            durationSec: 60,
            primaryTemplate: "split_comparison",
            voiceEngine: "edge_tts",
            voiceId: "en-US-AriaNeural",
            subtitleStyle: "hormozi_pop",
            status: "published",
            scenes: 8,
            mp4Path: "/api/v1/video-file?name=prototype",
            createdAt: iso(48),
          },
          {
            id: `proj_${crypto.randomBytes(5).toString("hex")}`,
            title: "Why Compound Interest Grows Exponentially (+87% Chart)",
            topicPrompt: "Animated 60fps odometer and bar chart showing compound growth over 20 years.",
            aspectRatio: "9:16",
            durationSec: 30,
            primaryTemplate: "stat_counter",
            voiceEngine: "edge_tts",
            voiceId: "en-US-ChristopherNeural",
            subtitleStyle: "karaoke_highlight",
            status: "draft",
            scenes: 5,
            mp4Path: null,
            createdAt: iso(72),
          },
        ];

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const p of sampleProjects) {
      const durationPerSceneMs = Math.max(5000, Math.round((p.durationSec * 1000) / p.scenes));
      const scenesArray: SceneData[] = Array.from({ length: p.scenes }, (_, idx) => {
        const headline = `${p.title.split(":")[0]} — Step ${idx + 1}`;
        return {
          scene_id: `sc_${String(idx + 1).padStart(2, "0")}`,
          order_index: idx + 1,
          scene_type: p.primaryTemplate,
          narration_text: p.topicPrompt,
          on_screen_headline: headline,
          animation_props: buildDefaultAnimationProps(p.primaryTemplate, headline),
          word_timestamps: generateEstimatedWordTimestamps(p.topicPrompt, durationPerSceneMs),
          duration_ms: durationPerSceneMs,
        };
      });

      db.prepare(
        `INSERT INTO video_projects (
          id, user_id, title, topic_prompt, aspect_ratio, duration_sec,
          primary_template, voice_engine, voice_id, subtitle_style,
          status, scenes_json, mp4_path, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        p.id,
        userId,
        p.title,
        p.topicPrompt,
        p.aspectRatio,
        p.durationSec,
        p.primaryTemplate,
        p.voiceEngine,
        p.voiceId,
        p.subtitleStyle,
        p.status,
        JSON.stringify(scenesArray),
        p.mp4Path,
        p.createdAt,
        p.createdAt
      );
    }

    db.prepare("UPDATE users SET demo_seeded = 1 WHERE id = ?").run(userId);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
}

export function listUserProjects(userId: string): VideoProjectSummary[] {
  ensureDemoProjectsSeeded(userId);
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, user_id, title, topic_prompt, aspect_ratio, duration_sec,
              primary_template, voice_engine, voice_id, subtitle_style,
              status, scenes_json, mp4_path, created_at, updated_at
       FROM video_projects
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .all(userId) as Array<{
    id: string;
    user_id: string;
    title: string;
    topic_prompt: string;
    aspect_ratio: string;
    duration_sec: number;
    primary_template: string;
    voice_engine: string;
    voice_id: string;
    subtitle_style: string;
    status: string;
    scenes_json: string;
    mp4_path: string | null;
    created_at: string;
    updated_at: string;
  }>;

  return rows.map((r) => {
    const primaryTemplate = (r.primary_template || "diagram_flow") as SceneType;
    const normalizedScenes = normalizeScenesJson(r.scenes_json, primaryTemplate, r.topic_prompt);
    return {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      topicPrompt: r.topic_prompt,
      aspectRatio: r.aspect_ratio === "16:9" ? "16:9" : "9:16",
      durationSec: r.duration_sec,
      primaryTemplate,
      voiceEngine: r.voice_engine,
      voiceId: r.voice_id,
      subtitleStyle: (r.subtitle_style || "karaoke_highlight") as SubtitleStyle,
      status: r.status as VideoProjectSummary["status"],
      scenesCount: normalizedScenes.length,
      mp4Path: r.mp4_path,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
}

export interface VideoProjectDetail extends VideoProjectSummary {
  voiceSpeed: number;
  scenes: SceneData[];
}

export function getUserProjectById(
  userId: string,
  projectId: string
): VideoProjectDetail | null {
  ensureDemoProjectsSeeded(userId);
  const db = getDb();
  const r = db
    .prepare(
      `SELECT id, user_id, title, topic_prompt, aspect_ratio, duration_sec,
              primary_template, voice_engine, voice_id, subtitle_style, voice_speed,
              status, scenes_json, mp4_path, created_at, updated_at
       FROM video_projects
       WHERE id = ? AND user_id = ?
       LIMIT 1`
    )
    .get(projectId, userId) as
    | {
        id: string;
        user_id: string;
        title: string;
        topic_prompt: string;
        aspect_ratio: string;
        duration_sec: number;
        primary_template: string;
        voice_engine: string;
        voice_id: string;
        subtitle_style: string;
        voice_speed: number | null;
        status: string;
        scenes_json: string;
        mp4_path: string | null;
        created_at: string;
        updated_at: string;
      }
    | undefined;

  if (!r) return null;

  const primaryTemplate = (r.primary_template || "diagram_flow") as SceneType;
  const scenes = normalizeScenesJson(r.scenes_json, primaryTemplate, r.topic_prompt);

  return {
    id: r.id,
    userId: r.user_id,
    title: r.title,
    topicPrompt: r.topic_prompt,
    aspectRatio: r.aspect_ratio === "16:9" ? "16:9" : "9:16",
    durationSec: r.duration_sec,
    primaryTemplate,
    voiceEngine: r.voice_engine,
    voiceId: r.voice_id,
    subtitleStyle: (r.subtitle_style || "karaoke_highlight") as SubtitleStyle,
    voiceSpeed: typeof r.voice_speed === "number" ? r.voice_speed : 1.0,
    status: r.status as VideoProjectSummary["status"],
    scenesCount: scenes.length,
    scenes,
    mp4Path: r.mp4_path,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function getDashboardTelemetry(userId: string) {
  const projects = listUserProjects(userId);
  const db = getDb();
  const scheduledRows = db
    .prepare(
      `SELECT DISTINCT project_id FROM scheduled_posts WHERE user_id = ? AND status = 'scheduled'`
    )
    .all(userId) as Array<{ project_id: string }>;

  const scheduledProjectIds = new Set<string>(scheduledRows.map((r) => r.project_id));
  for (const p of projects) {
    if (p.status === "scheduled") {
      scheduledProjectIds.add(p.id);
    }
  }

  const renderedCount = projects.filter(
    (p) => p.status === "rendered" || p.status === "published" || p.status === "scheduled"
  ).length;

  return {
    totalProjects: projects.length,
    renderedExports: renderedCount,
    scheduledReels: scheduledProjectIds.size,
    projects,
  };
}
