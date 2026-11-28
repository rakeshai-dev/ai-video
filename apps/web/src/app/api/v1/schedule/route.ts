import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listMemberScheduledReels } from "@/lib/schedule";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") || "all";
  const month = searchParams.get("month") || undefined;

  const data = listMemberScheduledReels(user.id, { status, month });
  return NextResponse.json(data);
}
