import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getUserProjectById } from "@/lib/projects";
import { getLatestRenderForProject } from "@/lib/render-engine";

export const dynamic = "force-dynamic";

export async function GET(
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

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let timer: ReturnType<typeof setInterval> | null = null;

      const cleanup = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        try {
          controller.close();
        } catch {
          // ignore if already closed
        }
      };

      request.signal.addEventListener("abort", cleanup);

      const pushSnapshot = () => {
        if (closed) return;
        try {
          const latestRender = getLatestRenderForProject(user.id, id);
          const db = getDb();
          const u = db
            .prepare("SELECT credits_balance FROM users WHERE id = ?")
            .get(user.id) as { credits_balance: number } | undefined;

          const phase = !latestRender
            ? "idle"
            : latestRender.status === "completed"
            ? "render_complete"
            : latestRender.status === "failed"
            ? "render_failed"
            : "rendering_mp4";

          const payload = {
            project_id: id,
            phase,
            progress_pct: latestRender?.progressPct ?? 0,
            current_step_label: latestRender?.currentStep ?? "Ready to export",
            output_mp4_url: latestRender?.outputMp4Url ?? null,
            credits_balance: u?.credits_balance ?? user.creditsBalance,
            render: latestRender,
          };

          controller.enqueue(
            encoder.encode(`event: progress\ndata: ${JSON.stringify(payload)}\n\n`)
          );

          if (phase === "render_complete" || phase === "render_failed" || phase === "idle") {
            cleanup();
          }
        } catch {
          cleanup();
        }
      };

      pushSnapshot();
      if (!closed) {
        timer = setInterval(pushSnapshot, 750);
      }
    },
  });

  return new NextResponse(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
