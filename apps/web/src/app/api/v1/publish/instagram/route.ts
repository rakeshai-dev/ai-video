import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getUserProjectById } from "@/lib/projects";
import {
  InstagramTokenDegradedError,
  publishOrScheduleInstagramReel,
} from "@/lib/instagram";

const publishSchema = z.object({
  projectId: z.string().trim().min(2),
  renderId: z.string().trim().nullable().optional(),
  caption: z
    .string()
    .trim()
    .min(3, "Please provide a caption for your Instagram Reel.")
    .max(2200, "Instagram captions cannot exceed 2,200 characters."),
  hashtags: z.array(z.string()).optional(),
  mode: z.enum(["now", "schedule"]).default("now"),
  scheduledFor: z.string().trim().nullable().optional(),
  timezone: z.string().trim().max(80).optional(),
  doiAutoComment: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = publishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid Instagram publish payload." },
        { status: 400 }
      );
    }

    const project = getUserProjectById(user.id, parsed.data.projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found in your isolated workspace." },
        { status: 404 }
      );
    }

    const result = await publishOrScheduleInstagramReel({
      userId: user.id,
      project,
      renderId: parsed.data.renderId,
      caption: parsed.data.caption,
      hashtags: parsed.data.hashtags,
      mode: parsed.data.mode,
      scheduledFor: parsed.data.scheduledFor,
      timezone: parsed.data.timezone || user.timezone,
      doiAutoComment: parsed.data.doiAutoComment,
    });

    return NextResponse.json(
      {
        status: parsed.data.mode === "schedule" ? "scheduled" : "published",
        sandboxMode: result.sandboxMode,
        post: result.post,
      },
      { status: parsed.data.mode === "schedule" ? 201 : 200 }
    );
  } catch (error) {
    if (error instanceof InstagramTokenDegradedError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          handle: error.handle,
        },
        { status: 401 }
      );
    }

    const code = (error as Error & { code?: string })?.code;
    if (
      code === "IG_NOT_CONNECTED" ||
      code === "RENDER_REQUIRED" ||
      code === "INVALID_SCHEDULE_TIME" ||
      code === "LIVE_META_CONFIG_REQUIRED"
    ) {
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : "Cannot publish Reel.",
          code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to publish Reel to Instagram.",
      },
      { status: 500 }
    );
  }
}
