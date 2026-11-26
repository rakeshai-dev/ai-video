import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { isRealApiKey, VOICE_CATALOG } from "@/lib/ai-generator";
import { getDb } from "@/lib/db";
import {
  generateEstimatedWordTimestamps,
  getUserProjectById,
  type SubtitleStyle,
} from "@/lib/projects";

const patchProjectSchema = z.object({
  title: z.string().trim().min(2).max(140).optional(),
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  voiceEngine: z.enum(["edge_tts", "elevenlabs"]).optional(),
  voiceId: z
    .string()
    .trim()
    .refine(
      (id) => VOICE_CATALOG.some((v) => v.voiceId === id),
      "Selected voice persona is not in the supported voice catalog."
    )
    .optional(),
  voiceSpeed: z.number().min(0.8).max(1.4).optional(),
  subtitleStyle: z
    .enum(["karaoke_highlight", "hormozi_pop", "kids_read_along", "clean_minimal"])
    .optional(),
});

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const project = getUserProjectById(user.id, id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found in your isolated workspace." },
      { status: 404 }
    );
  }

  return NextResponse.json({ project });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = getUserProjectById(user.id, id);
  if (!existing) {
    return NextResponse.json(
      { error: "Project not found in your isolated workspace." },
      { status: 404 }
    );
  }

  try {
    const body = await request.json();
    const parsed = patchProjectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid project update payload." },
        { status: 400 }
      );
    }

    const patch = parsed.data;
    const nextTitle = patch.title ?? existing.title;
    const nextAspectRatio = patch.aspectRatio ?? existing.aspectRatio;
    const nextSubtitleStyle: SubtitleStyle = patch.subtitleStyle ?? existing.subtitleStyle;
    const nextVoiceSpeed = patch.voiceSpeed ?? existing.voiceSpeed;

    const elevenlabsConfigured = isRealApiKey(process.env.ELEVENLABS_API_KEY);
    const requestedEngine = (patch.voiceEngine ?? existing.voiceEngine) as "edge_tts" | "elevenlabs";
    const requestedVoiceId = patch.voiceId ?? existing.voiceId;
    const chosenVoice = VOICE_CATALOG.find((v) => v.voiceId === requestedVoiceId);

    const effectiveVoiceEngine =
      requestedEngine === "elevenlabs" && !elevenlabsConfigured ? "edge_tts" : requestedEngine;
    const effectiveVoiceId =
      requestedEngine === "elevenlabs" && !elevenlabsConfigured
        ? chosenVoice?.fallbackEdgeVoiceId || "en-US-ChristopherNeural"
        : requestedVoiceId;

    // If speech speed changed, rescale estimated scene durations & word timestamps proportionally
    let updatedScenes = existing.scenes;
    if (
      typeof patch.voiceSpeed === "number" &&
      Math.abs(patch.voiceSpeed - existing.voiceSpeed) > 0.01
    ) {
      const ratio = existing.voiceSpeed / patch.voiceSpeed;
      updatedScenes = existing.scenes.map((sc) => {
        const nextDur = Math.min(15000, Math.max(3000, Math.round(sc.duration_ms * ratio)));
        return {
          ...sc,
          duration_ms: nextDur,
          word_timestamps: generateEstimatedWordTimestamps(sc.narration_text, nextDur),
        };
      });
    }

    const totalSec = Math.max(
      15,
      Math.round(updatedScenes.reduce((acc, s) => acc + s.duration_ms, 0) / 1000)
    );
    const nowIso = new Date().toISOString();
    const db = getDb();

    db.prepare(
      `UPDATE video_projects
       SET title = ?, aspect_ratio = ?, duration_sec = ?, voice_engine = ?, voice_id = ?,
           voice_speed = ?, subtitle_style = ?, scenes_json = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      nextTitle,
      nextAspectRatio,
      totalSec,
      effectiveVoiceEngine,
      effectiveVoiceId,
      nextVoiceSpeed,
      nextSubtitleStyle,
      JSON.stringify(updatedScenes),
      nowIso,
      id,
      user.id
    );

    const updated = getUserProjectById(user.id, id);
    return NextResponse.json({
      status: "updated",
      voiceFallbackApplied: requestedEngine === "elevenlabs" && !elevenlabsConfigured,
      project: updated,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update project." },
      { status: 500 }
    );
  }
}
