import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { generateEstimatedWordTimestamps, getUserProjectById } from "@/lib/projects";

export async function POST(
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

  const speed = Math.min(1.4, Math.max(0.8, project.voiceSpeed || 1.0));
  const syncedScenes = project.scenes.map((sc) => {
    const words = sc.narration_text.split(/\s+/).filter(Boolean).length;
    const calibratedMs = Math.min(
      18000,
      Math.max(3400, Math.round(((words * 414) / speed) + 550))
    );
    return {
      ...sc,
      duration_ms: calibratedMs,
      voiceover_url: `/api/v1/voices/audition?voiceId=${encodeURIComponent(project.voiceId)}`,
      word_timestamps: generateEstimatedWordTimestamps(sc.narration_text, calibratedMs),
    };
  });

  const totalSec = Math.max(
    15,
    Math.round(syncedScenes.reduce((acc, s) => acc + s.duration_ms, 0) / 1000)
  );
  const nowIso = new Date().toISOString();

  const db = getDb();
  db.prepare(
    `UPDATE video_projects
     SET scenes_json = ?, duration_sec = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(JSON.stringify(syncedScenes), totalSec, nowIso, id, user.id);

  return NextResponse.json({
    status: "assets_ready",
    syncedCount: syncedScenes.length,
    durationSec: totalSec,
    scenes: syncedScenes,
  });
}
