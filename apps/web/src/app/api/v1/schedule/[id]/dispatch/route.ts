import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { executeScheduledReelDispatch } from "@/lib/schedule";

const dispatchSchema = z.object({
  simulateFailure: z.boolean().optional(),
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
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = dispatchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid dispatch payload." }, { status: 400 });
    }

    const post = executeScheduledReelDispatch({
      userId: user.id,
      postId: id,
      simulateFailure:
        Boolean(parsed.data.simulateFailure) && process.env.NODE_ENV !== "production",
    });

    return NextResponse.json({
      status: post.status,
      post,
    });
  } catch (error) {
    const status = (error as Error & { status?: number })?.status || 500;
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to dispatch Reel.",
      },
      { status }
    );
  }
}
