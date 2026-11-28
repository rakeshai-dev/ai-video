import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { VOICE_CATALOG } from "@/lib/ai-generator";
import {
  countMemberDraftProjects,
  getMemberBrandKit,
  updateMemberBrandKit,
} from "@/lib/brand-kit";

const hexColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Colors must be valid 6-digit hex codes (e.g. #FF4F28).");

const updateBrandKitSchema = z.object({
  primaryColor: hexColorSchema.optional(),
  secondaryColor: hexColorSchema.optional(),
  accentColor: hexColorSchema.optional(),
  surfaceColor: hexColorSchema.optional(),
  displayFont: z
    .enum(["Space Grotesk", "Plus Jakarta Sans", "Montserrat", "Fredoka"])
    .optional(),
  bodyFont: z
    .enum(["Plus Jakarta Sans", "Inter", "JetBrains Mono"])
    .optional(),
  subtitlePreset: z
    .enum(["karaoke_highlight", "hormozi_pop", "kids_read_along", "clean_minimal"])
    .optional(),
  defaultVoiceEngine: z.enum(["edge_tts", "elevenlabs"]).optional(),
  defaultVoiceId: z
    .string()
    .trim()
    .refine(
      (id) => VOICE_CATALOG.some((v) => v.voiceId === id),
      "Selected default voice persona is not in the supported catalog."
    )
    .optional(),
  watermarkText: z
    .string()
    .trim()
    .max(36, "Watermark text must be 36 characters or fewer.")
    .optional(),
  watermarkPosition: z
    .enum(["top-right", "top-left", "bottom-right", "hidden"])
    .optional(),
  watermarkOpacity: z.number().min(15).max(100).optional(),
  safeZoneGuides: z.boolean().optional(),
  syncActiveProjects: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const fallbackWm = user.instagramHandle || `@${user.workspaceSlug}`;
  const brandKit = getMemberBrandKit(user.id, fallbackWm);
  const draftProjectsCount = countMemberDraftProjects(user.id);

  return NextResponse.json({
    brandKit,
    draftProjectsCount,
    voices: VOICE_CATALOG,
  });
}

export async function PUT(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const parsed = updateBrandKitSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || "Invalid Brand Kit settings." },
        { status: 400 }
      );
    }

    const result = updateMemberBrandKit(user.id, parsed.data);
    return NextResponse.json({
      status: "saved",
      brandKit: result.brandKit,
      syncedProjectsCount: result.syncedProjectsCount,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to save Brand Kit." },
      { status: 500 }
    );
  }
}
