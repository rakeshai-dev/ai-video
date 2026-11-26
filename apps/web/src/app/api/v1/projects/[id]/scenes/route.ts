import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { sanitizeAnimationProps } from "@/lib/ai-generator";
import { getDb } from "@/lib/db";
import {
  generateEstimatedWordTimestamps,
  getUserProjectById,
  type SceneData,
  type SceneType,
} from "@/lib/projects";

const addSceneSchema = z.object({
  sceneType: z
    .enum([
      "diagram_flow",
      "kids_counting",
      "split_comparison",
      "stat_counter",
      "illustrated_motion",
    ])
    .optional(),
  onScreenHeadline: z.string().trim().min(2).max(90).optional(),
  narrationText: z.string().trim().min(4).max(800).optional(),
});

export async function POST(
  request: NextRequest,
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

  if (project.scenes.length >= 20) {
    return NextResponse.json(
      { error: "Maximum of 20 scenes allowed per video project." },
      { status: 400 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = addSceneSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid new scene payload." },
        { status: 400 }
      );
    }

    const nextIndex = project.scenes.length + 1;
    const sceneType: SceneType = parsed.data.sceneType || project.primaryTemplate;
    const headline =
      parsed.data.onScreenHeadline || `Step ${nextIndex}: Key Visual Takeaway`;
    const narration =
      parsed.data.narrationText ||
      `Here is the next essential mechanism behind ${project.title}, animated clearly at sixty frames per second.`;

    const words = narration.split(/\s+/).filter(Boolean).length;
    const speed = Math.min(1.4, Math.max(0.8, project.voiceSpeed || 1.0));
    const durationMs = Math.min(15000, Math.max(4200, Math.round(((words * 414) / speed) + 600)));

    const newScene: SceneData = {
      scene_id: `sc_${crypto.randomBytes(4).toString("hex")}`,
      order_index: nextIndex,
      scene_type: sceneType,
      on_screen_headline: headline,
      narration_text: narration,
      visual_prompt: `${project.title} — ${headline}`,
      animation_props: sanitizeAnimationProps(
        sceneType,
        null,
        headline,
        project.title,
        nextIndex - 1
      ),
      word_timestamps: generateEstimatedWordTimestamps(narration, durationMs),
      duration_ms: durationMs,
    };

    const nextScenes = [...project.scenes, newScene];
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

    return NextResponse.json(
      {
        status: "scene_added",
        scene: newScene,
        scenes: nextScenes,
        durationSec: totalSec,
      },
      { status: 201 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to add scene." },
      { status: 500 }
    );
  }
}
