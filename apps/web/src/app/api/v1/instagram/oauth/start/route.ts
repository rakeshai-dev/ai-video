import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isRealApiKey } from "@/lib/ai-generator";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const appId = process.env.META_APP_ID;
  const appSecret = process.env.META_APP_SECRET;
  if (!isRealApiKey(appId) || !isRealApiKey(appSecret)) {
    const fallbackUrl = new URL("/dashboard/integrations", request.url);
    fallbackUrl.searchParams.set("oauth_notice", "meta_keys_not_configured");
    return NextResponse.redirect(fallbackUrl);
  }

  const state = crypto.randomBytes(20).toString("hex");
  const origin = (process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin).replace(
    /\/$/,
    ""
  );
  const redirectUri = `${origin}/api/v1/instagram/oauth/callback`;

  const authUrl = new URL("https://www.facebook.com/v21.0/dialog/oauth");
  authUrl.searchParams.set("client_id", appId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set(
    "scope",
    "instagram_basic,instagram_content_publish,pages_show_list,pages_read_engagement"
  );
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("state", state);

  const res = NextResponse.redirect(authUrl.toString());
  res.cookies.set("animora_ig_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/",
  });
  return res;
}
