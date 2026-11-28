import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { dispatchDueScheduledReels, listMemberScheduledReels } from "@/lib/schedule";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sweep = dispatchDueScheduledReels(user.id);
  const current = listMemberScheduledReels(user.id);

  return NextResponse.json({
    status: "swept",
    dispatchedCount: sweep.dispatchedCount,
    failedCount: sweep.failedCount,
    ...current,
  });
}
