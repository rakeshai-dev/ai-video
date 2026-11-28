import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { changeMemberPlanTier, getMemberBillingOverview } from "@/lib/billing";

const changePlanSchema = z.object({
  planTier: z.enum(["starter_free", "creator_pro", "educator_studio"]),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = changePlanSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid planTier. Expected starter_free, creator_pro, or educator_studio." },
        { status: 400 }
      );
    }

    const result = changeMemberPlanTier(user.id, parsed.data.planTier);
    const overview = getMemberBillingOverview(user.id);

    return NextResponse.json({
      ...result,
      overview,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to switch subscription plan." },
      { status: 500 }
    );
  }
}
