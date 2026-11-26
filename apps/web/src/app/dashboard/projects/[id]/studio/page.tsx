import React from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import StoryboardStudioClient from "@/components/StoryboardStudioClient";
import { getCurrentUser } from "@/lib/auth";
import { getUserProjectById } from "@/lib/projects";
import { isRealApiKey, VOICE_CATALOG } from "@/lib/ai-generator";

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

  const elevenlabsConfigured = isRealApiKey(process.env.ELEVENLABS_API_KEY);
  const cleanHandle = (user.instagramHandle || user.workspaceSlug || "animora_creator").replace(
    /^@/,
    ""
  );

  return (
    <DashboardShell
      user={user}
      title="Storyboard & 60fps Animation Studio"
      subtitle="Steps 2 & 3 • Edit scenes, live-preview 60fps animations, and sync neural voices"
    >
      <StoryboardStudioClient
        initialProject={project}
        userHandle={cleanHandle}
        voices={VOICE_CATALOG}
        elevenlabsConfigured={elevenlabsConfigured}
      />
    </DashboardShell>
  );
}
