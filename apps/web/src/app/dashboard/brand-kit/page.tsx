import React from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import BrandKitStudioClient from "@/components/BrandKitStudioClient";
import { getCurrentUser } from "@/lib/auth";
import { isRealApiKey, VOICE_CATALOG } from "@/lib/ai-generator";
import { countMemberDraftProjects, getMemberBrandKit } from "@/lib/brand-kit";

export default async function PersonalBrandKitPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const fallbackWatermark = user.instagramHandle || `@${user.workspaceSlug}`;
  const brandKit = getMemberBrandKit(user.id, fallbackWatermark);
  const draftProjectsCount = countMemberDraftProjects(user.id);
  const elevenlabsConfigured = isRealApiKey(process.env.ELEVENLABS_API_KEY);

  return (
    <DashboardShell
      user={user}
      title="Personal Brand Kit Studio"
      subtitle="Persistent brand colors, typography, karaoke subtitle styles & safe-zone watermark"
    >
      <BrandKitStudioClient
        initialBrandKit={brandKit}
        draftProjectsCount={draftProjectsCount}
        voices={VOICE_CATALOG}
        elevenlabsConfigured={elevenlabsConfigured}
      />
    </DashboardShell>
  );
}
