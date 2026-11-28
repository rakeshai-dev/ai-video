import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { resetMemberBrandKit } from "@/lib/brand-kit";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fallbackWm = user.instagramHandle || `@${user.workspaceSlug}`;
  const brandKit = resetMemberBrandKit(user.id, fallbackWm);
  return NextResponse.json({
    status: "reset",
    brandKit,
  });
}
