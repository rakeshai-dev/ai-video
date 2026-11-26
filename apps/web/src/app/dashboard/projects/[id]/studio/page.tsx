import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import { getCurrentUser } from "@/lib/auth";
import { getUserProjectById } from "@/lib/projects";

export default async function ProjectStudioPage({
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
    return (
      <DashboardShell
        user={user}
        title="Storyboard Not Found"
        subtitle="Strict multi-tenant isolation prevented loading an unknown project"
      >
        <div className="p-6 sm:p-10 max-w-2xl mx-auto">
          <div className="p-8 rounded-2xl bg-[#121216] border border-[#27272A] text-center space-y-4">
            <span className="material-symbols-outlined text-4xl text-[#EF4444]">lock</span>
            <h2 className="font-display font-bold text-xl text-white">
              Project Not Found in Your Workspace
            </h2>
            <p className="text-xs text-[#A1A1AA]">
              This storyboard does not exist or belongs to a different isolated tenant.
            </p>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#FF4F28] text-[#09090B] font-display font-bold text-xs"
            >
              ← Return to My Dashboard
            </Link>
          </div>
        </div>
      </DashboardShell>
    );
  }

  const totalDurationSec = Math.round(
    project.scenes.reduce((acc, s) => acc + s.duration_ms, 0) / 1000
  );

  return (
    <DashboardShell
      user={user}
      title={project.title}
      subtitle={`Steps 2 & 3 Storyboard Preview • ${project.scenes.length} Timed Scenes (${totalDurationSec}s)`}
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/dashboard/create"
            className="px-3 py-1.5 rounded-lg bg-[#18181D] hover:bg-[#27272A] border border-[#27272A] text-xs font-mono text-[#E4E4E7]"
          >
            + New Video
          </Link>
          <Link
            href="/dashboard"
            className="px-3 py-1.5 rounded-lg bg-[#FF4F28] text-[#09090B] font-display font-bold text-xs"
          >
            Back to Dashboard
          </Link>
        </div>
      }
    >
      <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
        {/* Project Telemetry Banner */}
        <section className="p-5 rounded-2xl bg-[#121216] border border-[#27272A] flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 font-mono text-[10px]">
              <span className="px-2 py-0.5 rounded bg-[#10B981]/15 border border-[#10B981]/30 text-[#9BFFCE] font-bold">
                ● STORYBOARD GENERATED (0 CREDITS USED)
              </span>
              <span className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272A] text-[#F59E0B]">
                {project.aspectRatio} • {project.durationSec}s Target
              </span>
              <span className="px-2 py-0.5 rounded bg-[#18181D] border border-[#27272A] text-[#E4E4E7]">
                Voice: {project.voiceId} ({project.voiceSpeed.toFixed(2)}x)
              </span>
            </div>
            <p className="text-xs text-[#A1A1AA] max-w-3xl">{project.topicPrompt}</p>
          </div>

          <div className="text-right font-mono text-[11px] text-[#71717A]">
            <div>Project ID: {project.id}</div>
            <div className="text-[#10B981]">Ready for 60fps Studio Editor (F-06)</div>
          </div>
        </section>

        {/* Ordered SceneData[] Storyboard Cards */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {project.scenes.map((scene) => (
            <article
              key={scene.scene_id}
              className="p-5 rounded-2xl bg-[#121216] border border-[#27272A] flex flex-col justify-between gap-4"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 font-mono text-[10px]">
                  <span className="px-2 py-0.5 rounded bg-[#FF4F28]/15 border border-[#FF4F28]/35 text-[#FFB4A4] font-bold">
                    SCENE {String(scene.order_index).padStart(2, "0")} •{" "}
                    {scene.scene_type.replace("_", " ").toUpperCase()}
                  </span>
                  <span className="text-[#A1A1AA]">
                    {(scene.duration_ms / 1000).toFixed(1)}s • {scene.word_timestamps.length} synced
                    words
                  </span>
                </div>

                <h3 className="font-display font-bold text-base text-white">
                  {scene.on_screen_headline}
                </h3>

                <div className="p-3 rounded-xl bg-[#09090B] border border-[#27272A] text-xs text-[#E4E4E7] leading-relaxed">
                  &ldquo;{scene.narration_text}&rdquo;
                </div>
              </div>

              <div className="pt-2 border-t border-[#27272A] flex items-center justify-between text-[10px] font-mono text-[#71717A]">
                <span>Subtitle Style: {project.subtitleStyle}</span>
                <span className="text-[#9BFFCE]">60fps Vector Props Ready</span>
              </div>
            </article>
          ))}
        </section>
      </div>
    </DashboardShell>
  );
}
