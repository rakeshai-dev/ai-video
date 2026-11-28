import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { refreshMemberInstagramToken } from "@/lib/instagram";

const refreshSchema = z.object({
  simulateExpired: z.boolean().optional(),
  sandboxMode: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid refresh request." }, { status: 400 });
  }

  const updated = refreshMemberInstagramToken(user.id, {
    simulateExpired:
      Boolean(parsed.data.simulateExpired) && process.env.NODE_ENV !== "production",
    sandboxMode: parsed.data.sandboxMode,
  });

  if (!updated) {
    return NextResponse.json(
      { error: "No connected Instagram account found to refresh." },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: updated.isExpired ? "expired" : "refreshed",
    account: updated,
  });
}
