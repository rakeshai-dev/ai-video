import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { getMemberBillingOverview, topUpMemberCredits } from "@/lib/billing";

const topupSchema = z.object({
  pack: z.enum(["25_cr", "60_cr", "150_cr"]).default("60_cr"),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = topupSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid credit top-up pack." }, { status: 400 });
    }

    const result = topUpMemberCredits(user.id, parsed.data.pack);
    const overview = getMemberBillingOverview(user.id);

    return NextResponse.json({
      status: result.status,
      txId: result.txId,
      pack: result.pack,
      creditsAdded: result.creditsAdded,
      creditsBalance: result.creditsBalance,
      overview,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to top up credits." },
      { status: 500 }
    );
  }
}
