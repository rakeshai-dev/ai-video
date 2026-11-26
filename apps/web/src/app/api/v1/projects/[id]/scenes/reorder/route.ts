import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserProjectById, type SceneData } from "@/lib/projects";

const reorderSchema = z.object({
  orderedSceneIds: z.array(z.string().min(1)).min(1),
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

  try {
    const body = await request.json();
    const parsed = reorderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "orderedSceneIds array is required." },
        { status: 400 }
      );
    }

    const { orderedSceneIds } = parsed.data;
    if (orderedSceneIds.length !== project.scenes.length) {
      return NextResponse.json(
        { error: "orderedSceneIds count must match existing project scenes." },
        { status: 400 }
      );
    }

    const byId = new Map<string, SceneData>(project.scenes.map((s) => [s.scene_id, s]));
    const reordered: SceneData[] = [];

    for (let i = 0; i < orderedSceneIds.length; i++) {
      const found = byId.get(orderedSceneIds[i]);
      if (!found) {
        return NextResponse.json(
          { error: `Unknown scene id in reorder payload: ${orderedSceneIds[i]}` },
          { status: 400 }
        );
      }
      reordered.push({ ...found, order_index: i + 1 });
      byId.delete(orderedSceneIds[i]);
    }

    const nowIso = new Date().toISOString();
    const db = getDb();
    db.prepare(
      `UPDATE video_projects SET scenes_json = ?, updated_at = ? WHERE id = ? AND user_id = ?`
    ).run(JSON.stringify(reordered), nowIso, id, user.id);

    return NextResponse.json({
      status: "reordered",
      scenes: reordered,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to reorder scenes." },
      { status: 500 }
    );
  }
}
