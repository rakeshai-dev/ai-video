import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { getCurrentUser } from "@/lib/auth";
import { getUserProjectById } from "@/lib/projects";

export default async function ProjectPublishHandoffPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const { id } = await params;
  const project = getUserProjectById(user.id, id);

  if (!project) {
    redirect("/dashboard");
  }

  const totalDurationSec = Math.round(
    project.scenes.reduce((acc, s) => acc + s.duration_ms, 0) / 1000
  );

  return (
    <DashboardShell
      user={user}
      title="Step 4: 1080p MP4 Render & Publish"
      subtitle={`${project.title} • ${project.scenes.length} Timed Scenes (${totalDurationSec}s)`}
      actions={
        <Link
          href={`/dashboard/projects/${project.id}/studio`}
          className="px-3.5 py-2 rounded-xl bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] font-display font-bold text-xs text-[#E4E4E7]"
        >
          ← Back to 60fps Studio
        </Link>
      }
    >
      <div className="p-6 sm:p-10 max-w-4xl mx-auto space-y-6">
        <section className="p-6 sm:p-8 rounded-2xl bg-[#121216] border border-[#27272A] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10B981]/15 border border-[#10B981]/30 font-mono text-xs text-[#9BFFCE] font-bold">
              ● STORYBOARD LOCKED & READY FOR EXPORT
            </span>
            <span className="font-mono text-xs text-[#F59E0B]">
              Export Cost: 1 Render Credit ({user.creditsBalance} Remaining)
            </span>
          </div>

          <div>
            <h2 className="font-display font-bold text-2xl text-white">{project.title}</h2>
            <p className="text-xs text-[#A1A1AA] mt-1">{project.topicPrompt}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-xl bg-[#09090B] border border-[#27272A]">
              <div className="font-mono text-[10px] text-[#71717A] uppercase">Resolution</div>
              <div className="font-display font-bold text-sm text-white mt-1">
                {project.aspectRatio === "9:16" ? "1080×1920 (9:16)" : "1920×1080 (16:9)"}
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#09090B] border border-[#27272A]">
              <div className="font-mono text-[10px] text-[#71717A] uppercase">Frame Rate</div>
              <div className="font-display font-bold text-sm text-[#10B981] mt-1">
                60 FPS H.264
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#09090B] border border-[#27272A]">
              <div className="font-mono text-[10px] text-[#71717A] uppercase">Scenes & Length</div>
              <div className="font-display font-bold text-sm text-white mt-1">
                {project.scenes.length} Scenes ({totalDurationSec}s)
              </div>
            </div>
            <div className="p-3.5 rounded-xl bg-[#09090B] border border-[#27272A]">
              <div className="font-mono text-[10px] text-[#71717A] uppercase">Captions</div>
              <div className="font-display font-bold text-sm text-[#FFB4A4] mt-1 truncate">
                {project.subtitleStyle.replace(/_/g, " ")}
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-[#18181D] border border-[#27272A] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="font-display font-bold text-sm text-white">
                Headless 1080p60 FFmpeg MP4 Render Pipeline (Next Milestone: F-07)
              </div>
              <p className="text-xs text-[#A1A1AA]">
                All scene edits, 60fps animation props, voice settings, and word timestamps are
                saved in SQLite and ready for headless MP4 rendering in Feature F-07.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Link
                href={`/dashboard/projects/${project.id}/studio`}
                className="px-4 py-2.5 rounded-xl bg-[#FF4F28] hover:bg-[#FF6542] text-[#09090B] font-display font-bold text-xs"
              >
                Continue Editing in Studio
              </Link>
              <Link
                href="/dashboard"
                className="px-4 py-2.5 rounded-xl bg-[#09090B] hover:bg-[#27272A] border border-[#27272A] font-display font-bold text-xs text-white"
              >
                Dashboard
              </Link>
            </div>
          </div>
        </section>
      </div>
    </DashboardShell>
  );
}
