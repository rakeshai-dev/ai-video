import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isRealApiKey } from "@/lib/ai-generator";
import {
  disconnectMemberInstagramAccount,
  getMemberInstagramAccount,
  listRecentInstagramDispatches,
} from "@/lib/instagram";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const account = getMemberInstagramAccount(user.id);
  const recentDispatches = listRecentInstagramDispatches(user.id, 6);
  const metaOAuthConfigured =
    isRealApiKey(process.env.META_APP_ID) && isRealApiKey(process.env.META_APP_SECRET);

  return NextResponse.json({
    account,
    recentDispatches,
    metaOAuthConfigured,
    tenantId: user.id,
  });
}

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  disconnectMemberInstagramAccount(user.id);
  return NextResponse.json({
    status: "disconnected",
    account: null,
  });
}
