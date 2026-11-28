import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getUserProjectById } from "@/lib/projects";
import {
  generateInstagramCaptionForProject,
  getMemberInstagramAccount,
} from "@/lib/instagram";

const captionSchema = z.object({
  tone: z
    .enum(["educational", "kids_parent_friendly", "viral_hook", "professional_brand"])
    .default("educational"),
  includeCta: z.boolean().default(true),
  doiAutoComment: z.boolean().default(false),
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

  const body = await request.json().catch(() => ({}));
  const parsed = captionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message || "Invalid caption request." },
      { status: 400 }
    );
  }

  const ig = getMemberInstagramAccount(user.id);
  const handle = ig?.handle || user.instagramHandle || `@${user.workspaceSlug}`;

  const generated = await generateInstagramCaptionForProject({
    project,
    handle,
    tone: parsed.data.tone,
    includeCta: parsed.data.includeCta,
    doiAutoComment: parsed.data.doiAutoComment,
  });

  return NextResponse.json(generated);
}
