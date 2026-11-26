import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { generateProjectStoryboard, isRealApiKey, VOICE_CATALOG } from "@/lib/ai-generator";
import { getDashboardTelemetry, type SceneType, type SubtitleStyle } from "@/lib/projects";
import { getDb } from "@/lib/db";

const createProjectSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Please enter a video title (at least 3 characters).")
    .max(140, "Video title must be 140 characters or fewer."),
  topicPrompt: z
    .string()
    .trim()
    .min(3, "Please describe your video topic or script.")
    .max(4000, "Topic or script is too long (max 4,000 characters)."),
  hookLine: z.string().trim().max(300).optional(),
  mode: z.enum(["brainstorm", "custom_script"]).optional().default("brainstorm"),
  customScript: z.string().trim().max(8000).optional(),
  aspectRatio: z.enum(["9:16", "16:9"]).default("9:16"),
  durationSec: z.union([z.literal(30), z.literal(60), z.literal(90)]).default(60),
  primaryTemplate: z
    .enum([
      "diagram_flow",
      "kids_counting",
      "split_comparison",
      "stat_counter",
      "illustrated_motion",
    ])
    .default("diagram_flow"),
  voiceEngine: z.enum(["edge_tts", "elevenlabs"]).default("edge_tts"),
  voiceId: z.string().trim().min(2).max(80).default("en-US-ChristopherNeural"),
  voiceSpeed: z.number().min(0.8).max(1.4).optional().default(1.0),
  subtitleStyle: z
    .enum(["karaoke_highlight", "hormozi_pop", "kids_read_along", "clean_minimal"])
    .optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const telemetry = getDashboardTelemetry(user.id);
  return NextResponse.json(telemetry);
}

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = createProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid project configuration." },
        { status: 400 }
      );
    }

    const data = parsed.data;
    if (data.mode === "custom_script" && (!data.customScript || data.customScript.trim().length < 15)) {
      return NextResponse.json(
        { error: "Please paste at least 15 characters of custom script or lecture notes." },
        { status: 400 }
      );
    }

    const db = getDb();
    const brandRow = db
      .prepare("SELECT subtitle_preset FROM brand_kits WHERE user_id = ?")
      .get(user.id) as { subtitle_preset: string } | undefined;

    const resolvedSubtitleStyle: SubtitleStyle =
      data.subtitleStyle ||
      (data.primaryTemplate === "kids_counting"
        ? "kids_read_along"
        : data.primaryTemplate === "split_comparison"
        ? "hormozi_pop"
        : ((brandRow?.subtitle_preset as SubtitleStyle) || "karaoke_highlight"));

    // Automatic fallback metadata if ElevenLabs Pro selected without an ElevenLabs key configured
    const elevenlabsConfigured = isRealApiKey(process.env.ELEVENLABS_API_KEY);
    const chosenVoice = VOICE_CATALOG.find((v) => v.voiceId === data.voiceId);
    const effectiveVoiceEngine =
      data.voiceEngine === "elevenlabs" && !elevenlabsConfigured ? "edge_tts" : data.voiceEngine;
    const effectiveVoiceId =
      data.voiceEngine === "elevenlabs" && !elevenlabsConfigured
        ? chosenVoice?.fallbackEdgeVoiceId || "en-US-ChristopherNeural"
        : data.voiceId;

    const { scenes, providerUsed } = await generateProjectStoryboard({
      title: data.title,
      topicPrompt: data.topicPrompt,
      hookLine: data.hookLine,
      mode: data.mode,
      customScript: data.customScript,
      durationSec: data.durationSec,
      aspectRatio: data.aspectRatio,
      primaryTemplate: data.primaryTemplate as SceneType,
      voiceSpeed: data.voiceSpeed,
    });

    const projectId = `proj_${crypto.randomBytes(6).toString("hex")}`;
    const nowIso = new Date().toISOString();

    db.prepare(
      `INSERT INTO video_projects (
        id, user_id, title, topic_prompt, aspect_ratio, duration_sec,
        primary_template, voice_engine, voice_id, subtitle_style, voice_speed,
        status, scenes_json, mp4_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, NULL, ?, ?)`
    ).run(
      projectId,
      user.id,
      data.title,
      data.topicPrompt,
      data.aspectRatio,
      data.durationSec,
      data.primaryTemplate,
      effectiveVoiceEngine,
      effectiveVoiceId,
      resolvedSubtitleStyle,
      data.voiceSpeed,
      JSON.stringify(scenes),
      nowIso,
      nowIso
    );

    return NextResponse.json(
      {
        status: "created",
        providerUsed,
        voiceFallbackApplied: data.voiceEngine === "elevenlabs" && !elevenlabsConfigured,
        project: {
          id: projectId,
          userId: user.id,
          title: data.title,
          topicPrompt: data.topicPrompt,
          aspectRatio: data.aspectRatio,
          durationSec: data.durationSec,
          primaryTemplate: data.primaryTemplate,
          voiceEngine: effectiveVoiceEngine,
          voiceId: effectiveVoiceId,
          voiceSpeed: data.voiceSpeed,
          subtitleStyle: resolvedSubtitleStyle,
          status: "draft",
          scenesCount: scenes.length,
          scenes,
          createdAt: nowIso,
          updatedAt: nowIso,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create video project." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("id");
  if (!projectId) {
    return NextResponse.json({ error: "Project id is required." }, { status: 400 });
  }

  const db = getDb();
  // Strict multi-tenant isolation: DELETE only if both id AND user_id match
  const result = db
    .prepare("DELETE FROM video_projects WHERE id = ? AND user_id = ?")
    .run(projectId, user.id);

  if (result.changes === 0) {
    return NextResponse.json({ error: "Project not found in your workspace." }, { status: 404 });
  }

  return NextResponse.json({ status: "deleted", id: projectId });
}
