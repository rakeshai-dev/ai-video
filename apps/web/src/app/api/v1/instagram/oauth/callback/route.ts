import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser, timingSafeEqualStr } from "@/lib/auth";
import { isRealApiKey } from "@/lib/ai-generator";
import { connectMemberInstagramAccount } from "@/lib/instagram";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state") || "";
  const storedState = request.cookies.get("animora_ig_oauth_state")?.value || "";

  const dest = new URL("/dashboard/integrations", request.url);

  if (!code || !state || !storedState || !timingSafeEqualStr(state, storedState)) {
    dest.searchParams.set("oauth_error", "invalid_oauth_state");
    return NextResponse.redirect(dest);
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!isRealApiKey(appId) || !isRealApiKey(appSecret)) {
    dest.searchParams.set("oauth_notice", "meta_keys_not_configured");
    return NextResponse.redirect(dest);
  }

  try {
    const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
      /\/$/,
      ""
    );
    const redirectUri = `${origin}/api/v1/instagram/oauth/callback`;

    // 1. Exchange OAuth code for short-lived user token
    const shortRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?client_id=${encodeURIComponent(
        appId
      )}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${encodeURIComponent(
        appSecret
      )}&code=${encodeURIComponent(code)}`
    );
    const shortJson = await shortRes.json();
    if (!shortRes.ok || !shortJson?.access_token) {
      throw new Error("Short-lived token exchange failed");
    }

    // 2. Exchange for 60-day long-lived Meta bearer token
    const longRes = await fetch(
      `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${encodeURIComponent(
        appId
      )}&client_secret=${encodeURIComponent(
        appSecret
      )}&fb_exchange_token=${encodeURIComponent(shortJson.access_token)}`
    );
    const longJson = await longRes.json();
    const longToken = String(longJson?.access_token || shortJson.access_token);

    // 3. Resolve linked Facebook Page + Instagram Creator/Business account
    const pagesRes = await fetch(
      `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account{id,username,name,followers_count}&access_token=${encodeURIComponent(
        longToken
      )}`
    );
    const pagesJson = await pagesRes.json();
    const firstWithIg = Array.isArray(pagesJson?.data)
      ? pagesJson.data.find((p: Record<string, unknown>) => p?.instagram_business_account)
      : null;

    if (!firstWithIg?.instagram_business_account?.username) {
      dest.searchParams.set("oauth_error", "ERR_PERSONAL_TIER");
      return NextResponse.redirect(dest);
    }

    const igObj = firstWithIg.instagram_business_account;
    connectMemberInstagramAccount({
      userId: user.id,
      rawHandle: String(igObj.username),
      displayName: String(igObj.name || igObj.username),
      accountType: "CREATOR",
      sandboxMode: false,
      accessTokenOverride: longToken,
    });

    const okRes = NextResponse.redirect(dest);
    okRes.cookies.delete("animora_ig_oauth_state");
    return okRes;
  } catch {
    dest.searchParams.set("oauth_error", "oauth_exchange_failed");
    return NextResponse.redirect(dest);
  }
}
