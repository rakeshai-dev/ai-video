import crypto from "node:crypto";
import { getDb } from "@/lib/db";

export interface VideoProjectSummary {
  id: string;
  userId: string;
  title: string;
  topicPrompt: string;
  aspectRatio: "9:16" | "16:9";
  durationSec: number;
  primaryTemplate: string;
  voiceEngine: string;
  voiceId: string;
  subtitleStyle: string;
  status: "draft" | "rendering" | "rendered" | "scheduled" | "published";
  scenesCount: number;
  mp4Path: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Seeds realistic sample projects ONLY for the pre-seeded demo creator accounts (`usr_demo_*`).
 * Brand-new real users who sign up start with 0 projects so they experience the First-Time Empty Onboarding state (`14A/B`).
 */
export function ensureDemoProjectsSeeded(userId: string) {
  if (!userId.startsWith("usr_demo_")) return;
  const db = getDb();
  const countRow = db
    .prepare("SELECT COUNT(*) as cnt FROM video_projects WHERE user_id = ?")
    .get(userId) as { cnt: number };

  if (countRow.cnt > 0) return;

  const now = new Date();
  const iso = (hoursAgo: number) => new Date(now.getTime() - hoursAgo * 3600 * 1000).toISOString();

  const sampleProjects =
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

  for (const p of sampleProjects) {
    const scenesArray = Array.from({ length: p.scenes }, (_, idx) => ({
      id: `sc-${idx + 1}`,
      title: `Scene ${idx + 1}`,
      template: p.primaryTemplate,
      narration: p.topicPrompt,
      durationSec: Math.max(5, Math.round(p.durationSec / p.scenes)),
    }));

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
    let scenesCount = 0;
    try {
      const parsed = JSON.parse(r.scenes_json);
      scenesCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      scenesCount = 0;
    }
    return {
      id: r.id,
      userId: r.user_id,
      title: r.title,
      topicPrompt: r.topic_prompt,
      aspectRatio: r.aspect_ratio === "16:9" ? "16:9" : "9:16",
      durationSec: r.duration_sec,
      primaryTemplate: r.primary_template,
      voiceEngine: r.voice_engine,
      voiceId: r.voice_id,
      subtitleStyle: r.subtitle_style,
      status: r.status as VideoProjectSummary["status"],
      scenesCount,
      mp4Path: r.mp4_path,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  });
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
