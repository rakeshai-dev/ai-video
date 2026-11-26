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

  return NextResponse.json({ project });
}
