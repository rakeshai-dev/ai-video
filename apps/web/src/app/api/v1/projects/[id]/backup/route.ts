import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserProjectById } from "@/lib/projects";

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

  const backupBundle = {
    exportedAt: new Date().toISOString(),
    projectId: project.id,
    title: project.title,
    topicPrompt: project.topicPrompt,
    aspectRatio: project.aspectRatio,
    durationSec: project.durationSec,
    voiceEngine: project.voiceEngine,
    voiceId: project.voiceId,
    voiceSpeed: project.voiceSpeed,
    subtitleStyle: project.subtitleStyle,
    scenes: project.scenes,
  };

  const payload = JSON.stringify(backupBundle, null, 2);
  return new NextResponse(payload, {
    status: 200,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="animora-storyboard-backup-${project.id}.json"`,
    },
  });
}
