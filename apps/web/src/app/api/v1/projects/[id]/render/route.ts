import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getUserProjectById } from "@/lib/projects";
import {
  calculateRenderCreditCost,
  getLatestRenderForProject,
  getRecentCreditLedger,
  InsufficientCreditsError,
  startProjectRenderJob,
} from "@/lib/render-engine";

const startRenderSchema = z.object({
  aspectRatio: z.enum(["9:16", "16:9"]).optional(),
  fps: z.union([z.literal(30), z.literal(60)]).optional(),
  simulateFailure: z.boolean().optional(),
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
  const project = getUserProjectById(user.id, id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found in your isolated workspace." },
      { status: 404 }
    );
  }

  const totalSec = Math.max(
    10,
    Math.round(project.scenes.reduce((acc, s) => acc + s.duration_ms, 0) / 1000)
  );
  const { credits: requiredCredits, tierLabel } = calculateRenderCreditCost(
    project.durationSec || totalSec
  );
  const latestRender = getLatestRenderForProject(user.id, id);
  const recentLedger = getRecentCreditLedger(user.id, 6);

  return NextResponse.json({
    project,
    latestRender,
    recentLedger,
    creditsBalance: user.creditsBalance,
    requiredCredits,
    tierLabel,
  });
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const existing = getUserProjectById(user.id, id);
  if (!existing) {
    return NextResponse.json(
      { error: "Project not found in your isolated workspace." },
      { status: 404 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = startRenderSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid render parameters." },
        { status: 400 }
      );
    }

    const result = await startProjectRenderJob({
      userId: user.id,
      projectId: id,
      aspectRatio: parsed.data.aspectRatio,
      fps: parsed.data.fps,
      simulateFailure: parsed.data.simulateFailure,
    });

    return NextResponse.json(
      {
        status: result.alreadyRunning ? "already_rendering" : "rendering",
        render: result.render,
        creditsDeducted: result.creditsDeducted,
        remainingBalance: result.remainingBalance,
        sseStreamUrl: `/api/v1/projects/${id}/events`,
      },
      { status: 202 }
    );
  } catch (error) {
    if (error instanceof InsufficientCreditsError) {
      return NextResponse.json(
        {
          error: error.message,
          code: "INSUFFICIENT_CREDITS",
          requiredCredits: error.requiredCredits,
          currentBalance: error.currentBalance,
        },
        { status: 402 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to start 1080p MP4 render.",
      },
      { status: 500 }
    );
  }
}
