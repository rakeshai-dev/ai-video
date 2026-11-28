import React from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import ContentCalendarClient from "@/components/ContentCalendarClient";
import { getCurrentUser } from "@/lib/auth";
import { getMemberInstagramAccount } from "@/lib/instagram";
import { listMemberScheduledReels } from "@/lib/schedule";

export default async function ContentCalendarPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const igAccount = getMemberInstagramAccount(user.id);
  const { posts, eligibleProjects, summary } = listMemberScheduledReels(user.id);

  return (
    <DashboardShell
      user={user}
      title="Content Calendar & Reels Queue"
      subtitle="Automated Instagram Reels scheduling, queue inspection & cron dispatch"
    >
      <ContentCalendarClient
        initialPosts={posts}
        initialEligibleProjects={eligibleProjects}
        initialSummary={summary}
        igAccount={igAccount}
        userTimezone={user.timezone || "Asia/Kolkata"}
      />
    </DashboardShell>
  );
}
