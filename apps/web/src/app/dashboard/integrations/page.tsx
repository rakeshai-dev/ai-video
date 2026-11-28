import React from "react";
import { redirect } from "next/navigation";
import DashboardShell from "@/components/DashboardShell";
import InstagramConnectClient from "@/components/InstagramConnectClient";
import { getCurrentUser } from "@/lib/auth";
import { isRealApiKey } from "@/lib/ai-generator";
import {
  getMemberInstagramAccount,
  listRecentInstagramDispatches,
} from "@/lib/instagram";

export default async function InstagramIntegrationsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const account = getMemberInstagramAccount(user.id);
  const recentDispatches = listRecentInstagramDispatches(user.id, 6);
  const metaOAuthConfigured =
    isRealApiKey(process.env.META_APP_ID) && isRealApiKey(process.env.META_APP_SECRET);

  const suggestedHandle = (
    user.instagramHandle ||
    user.workspaceSlug.replace(/-/g, "_") ||
    "animora_creator"
  ).replace(/^@+/, "");

  return (
    <DashboardShell
      user={user}
      title="Instagram Connect & Security Vault"
      subtitle="Per-member isolated Meta Graph API v21.0 OAuth 2.0 & AES-256-GCM token vault"
    >
      <InstagramConnectClient
        initialAccount={account}
        initialDispatches={recentDispatches}
        metaOAuthConfigured={metaOAuthConfigured}
        tenantId={user.id}
        defaultSuggestedHandle={suggestedHandle}
        defaultDisplayName={user.fullName}
        isDevMode={process.env.NODE_ENV !== "production"}
      />
    </DashboardShell>
  );
}
