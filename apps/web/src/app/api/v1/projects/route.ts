import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDashboardTelemetry } from "@/lib/projects";
import { getDb } from "@/lib/db";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const telemetry = getDashboardTelemetry(user.id);
  return NextResponse.json(telemetry);
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
