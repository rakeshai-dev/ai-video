import React from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import RenderPublishClient from "@/components/RenderPublishClient";
import { getCurrentUser } from "@/lib/auth";
import { getUserProjectById } from "@/lib/projects";
import {
  calculateRenderCreditCost,
  getLatestRenderForProject,
  getRecentCreditLedger,
} from "@/lib/render-engine";

export default async function ProjectPublishPage({
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

  const totalSec = Math.max(
    10,
    Math.round(project.scenes.reduce((acc, s) => acc + s.duration_ms, 0) / 1000)
  );
  const { credits: requiredCredits, tierLabel } = calculateRenderCreditCost(
    project.durationSec || totalSec
  );
  const latestRender = getLatestRenderForProject(user.id, project.id);
  const recentLedger = getRecentCreditLedger(user.id, 6);
  const cleanHandle = (
    user.instagramHandle ||
    user.workspaceSlug ||
    "animora_creator"
  ).replace(/^@/, "");

  return (
    <DashboardShell
      user={user}
      title="Step 4: 1080p MP4 Export & Publisher"
      subtitle={`${project.title} • ${project.scenes.length} Timed Scenes (${totalSec}s)`}
    >
      <RenderPublishClient
        initialProject={project}
        initialRender={latestRender}
        initialLedger={recentLedger}
        initialCreditsBalance={user.creditsBalance}
        requiredCredits={requiredCredits}
        tierLabel={tierLabel}
        userHandle={cleanHandle}
        instagramConnected={user.instagramConnected}
      />
    </DashboardShell>
  );
}
