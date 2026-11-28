import React from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import BillingCreditsClient from "@/components/BillingCreditsClient";
import { getCurrentUser } from "@/lib/auth";
import { getMemberBillingOverview } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function BillingAndCreditsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const initialOverview = getMemberBillingOverview(user.id);

  return (
    <DashboardShell
      user={user}
      title="Video Credits Billing & Immutable Ledger"
      subtitle="Manage subscription tiers, top-up programmatic render credits, and audit transparent ledger telemetry"
    >
      <BillingCreditsClient
        initialOverview={initialOverview}
        userId={user.id}
        workspaceSlug={user.workspaceSlug}
      />
    </DashboardShell>
  );
}
