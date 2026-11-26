import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeAnimationProps } from "@/lib/ai-generator";
import { getDb } from "@/lib/db";
import {
  generateEstimatedWordTimestamps,
  getUserProjectById,
  type SceneType,
} from "@/lib/projects";

const updateSceneSchema = z.object({
  sceneType: z
    .enum([
      "diagram_flow",
      "kids_counting",
      "split_comparison",
      "stat_counter",
      "illustrated_motion",
    ])
    .optional(),
  onScreenHeadline: z.string().trim().min(1, "Headline cannot be empty.").max(95).optional(),
  narrationText: z.string().trim().min(2, "Narration cannot be empty.").max(1200).optional(),
  durationMs: z.number().int().min(2500).max(20000).optional(),
  animationProps: z.record(z.unknown()).optional(),
});

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string; sceneId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, sceneId } = await context.params;
  const project = getUserProjectById(user.id, id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found in your isolated workspace." },
      { status: 404 }
    );
  }

  const targetIdx = project.scenes.findIndex((s) => s.scene_id === sceneId);
  if (targetIdx === -1) {
    return NextResponse.json({ error: "Scene not found in this project." }, { status: 404 });
  }

  try {
    const body = await request.json();
    const parsed = updateSceneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid scene update payload." },
        { status: 400 }
      );
    }

    const patch = parsed.data;
    const current = project.scenes[targetIdx];
    const nextType: SceneType = patch.sceneType ?? current.scene_type;
    const nextHeadline = patch.onScreenHeadline ?? current.on_screen_headline;
    const nextNarration = patch.narrationText ?? current.narration_text;

    const narrationChanged = nextNarration !== current.narration_text;
    const speed = Math.min(1.4, Math.max(0.8, project.voiceSpeed || 1.0));
    const wordCount = nextNarration.split(/\s+/).filter(Boolean).length;

    const nextDurationMs =
      patch.durationMs ??
      (narrationChanged
        ? Math.min(18000, Math.max(3200, Math.round(((wordCount * 414) / speed) + 550)))
        : current.duration_ms);

    const rawPropsToSanitize =
      patch.animationProps !== undefined
        ? patch.animationProps
        : nextType !== current.scene_type
        ? null
        : current.animation_props;

    const nextAnimationProps = sanitizeAnimationProps(
      nextType,
      rawPropsToSanitize,
      nextHeadline,
      project.title,
      targetIdx
    );

    const nextWordTimestamps =
      narrationChanged || nextDurationMs !== current.duration_ms
        ? generateEstimatedWordTimestamps(nextNarration, nextDurationMs)
        : current.word_timestamps;

    const updatedScene = {
      ...current,
      scene_type: nextType,
      on_screen_headline: nextHeadline,
      narration_text: nextNarration,
      duration_ms: nextDurationMs,
      animation_props: nextAnimationProps,
      word_timestamps: nextWordTimestamps,
    };

    const nextScenes = project.scenes.map((s, idx) => (idx === targetIdx ? updatedScene : s));
    const totalSec = Math.max(
      15,
      Math.round(nextScenes.reduce((acc, s) => acc + s.duration_ms, 0) / 1000)
    );
    const nowIso = new Date().toISOString();

    const db = getDb();
    db.prepare(
      `UPDATE video_projects
       SET scenes_json = ?, duration_sec = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(JSON.stringify(nextScenes), totalSec, nowIso, id, user.id);

    return NextResponse.json({
      status: "scene_updated",
      scene: updatedScene,
      scenes: nextScenes,
      durationSec: totalSec,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update scene." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string; sceneId: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id, sceneId } = await context.params;
  const project = getUserProjectById(user.id, id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found in your isolated workspace." },
      { status: 404 }
    );
  }

  if (project.scenes.length <= 1) {
    return NextResponse.json(
      { error: "A storyboard must contain at least 1 scene." },
      { status: 400 }
    );
  }

  const exists = project.scenes.some((s) => s.scene_id === sceneId);
  if (!exists) {
    return NextResponse.json({ error: "Scene not found in this project." }, { status: 404 });
  }

  const remaining = project.scenes
    .filter((s) => s.scene_id !== sceneId)
    .map((s, idx) => ({ ...s, order_index: idx + 1 }));

  const totalSec = Math.max(
    10,
    Math.round(remaining.reduce((acc, s) => acc + s.duration_ms, 0) / 1000)
  );
  const nowIso = new Date().toISOString();

  const db = getDb();
  db.prepare(
    `UPDATE video_projects
     SET scenes_json = ?, duration_sec = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(JSON.stringify(remaining), totalSec, nowIso, id, user.id);

  return NextResponse.json({
    status: "scene_deleted",
    deletedSceneId: sceneId,
    scenes: remaining,
    durationSec: totalSec,
  });
}
