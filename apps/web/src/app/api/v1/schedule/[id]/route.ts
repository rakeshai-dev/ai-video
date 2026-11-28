import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  cancelMemberScheduledReel,
  getScheduledReelById,
  updateMemberScheduledReel,
} from "@/lib/schedule";

const patchScheduleSchema = z.object({
  scheduledFor: z.string().trim().min(4).optional(),
  caption: z.string().trim().min(3).max(2200).optional(),
  timezone: z.string().trim().max(80).optional(),
  doiAutoComment: z.boolean().optional(),
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
  const post = getScheduledReelById(user.id, id);
  if (!post) {
    return NextResponse.json(
      { error: "Scheduled Reel not found in your isolated workspace." },
      { status: 404 }
    );
  }

  return NextResponse.json({ post });
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
  try {
    const body = await request.json();
    const parsed = patchScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid schedule update payload." },
        { status: 400 }
      );
    }

    const updated = updateMemberScheduledReel({
      userId: user.id,
      postId: id,
      ...parsed.data,
    });

    if (!updated) {
      return NextResponse.json(
        { error: "Scheduled Reel not found in your isolated workspace." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      status: "updated",
      post: updated,
    });
  } catch (error) {
    const code = (error as Error & { code?: string })?.code;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to update scheduled Reel.",
        code,
      },
      { status: code === "INVALID_SCHEDULE_TIME" ? 400 : 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const removed = cancelMemberScheduledReel(user.id, id);
  if (!removed) {
    return NextResponse.json(
      { error: "Scheduled Reel not found in your isolated workspace." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: "cancelled",
    id,
  });
}
