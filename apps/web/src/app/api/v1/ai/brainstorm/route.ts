import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { generateBrainstormIdeas } from "@/lib/ai-generator";
import type { SceneType } from "@/lib/projects";

const brainstormSchema = z.object({
  topic: z
    .string()
    .trim()
    .min(2, "Please enter a topic, niche, or question (at least 2 characters).")
    .max(400, "Topic prompt must be 400 characters or fewer."),
  primaryTemplate: z
    .enum([
      "diagram_flow",
      "kids_counting",
      "split_comparison",
      "stat_counter",
      "illustrated_motion",
    ])
    .optional()
    .default("diagram_flow"),
  durationSec: z
    .union([z.literal(30), z.literal(60), z.literal(90)])
    .optional()
    .default(60),
  variationSeed: z.number().int().min(0).max(100000).optional().default(0),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = brainstormSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid brainstorm prompt." },
        { status: 400 }
      );
    }

    const { topic, primaryTemplate, durationSec, variationSeed } = parsed.data;
    const result = await generateBrainstormIdeas({
      topic,
      primaryTemplate: primaryTemplate as SceneType,
      durationSec,
      variationSeed,
    });

    return NextResponse.json({
      status: "ok",
      providerUsed: result.providerUsed,
      ideas: result.ideas,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate video concepts." },
      { status: 500 }
    );
  }
}
