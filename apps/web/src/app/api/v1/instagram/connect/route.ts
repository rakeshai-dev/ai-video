import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  connectMemberInstagramAccount,
  InstagramPersonalTierError,
} from "@/lib/instagram";

const connectSchema = z.object({
  handle: z.string().trim().min(2).max(40).optional(),
  ig_username: z.string().trim().min(2).max(40).optional(),
  displayName: z.string().trim().max(80).optional(),
  accountType: z.enum(["CREATOR", "BUSINESS", "PERSONAL"]).default("CREATOR"),
  sandboxMode: z.boolean().default(true),
  simulateExpired: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const parsed = connectSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid Instagram connection payload." },
        { status: 400 }
      );
    }

    const rawHandle =
      parsed.data.handle ||
      parsed.data.ig_username ||
      user.workspaceSlug ||
      "animora_creator";

    const account = connectMemberInstagramAccount({
      userId: user.id,
      rawHandle,
      displayName: parsed.data.displayName,
      accountType: parsed.data.accountType,
      sandboxMode: parsed.data.sandboxMode,
      simulateExpired:
        Boolean(parsed.data.simulateExpired) && process.env.NODE_ENV !== "production",
    });

    return NextResponse.json({
      status: "connected",
      account,
    });
  } catch (error) {
    if (error instanceof InstagramPersonalTierError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to connect Instagram account.",
      },
      { status: 500 }
    );
  }
}
