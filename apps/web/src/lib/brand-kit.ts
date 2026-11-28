import { getDb } from "@/lib/db";
import { VOICE_CATALOG } from "@/lib/ai-generator";
import type { SubtitleStyle } from "@/lib/projects";

export type DisplayFontOption =
  | "Space Grotesk"
  | "Plus Jakarta Sans"
  | "Montserrat"
  | "Fredoka";

export type BodyFontOption =
  | "Plus Jakarta Sans"
  | "Inter"
  | "JetBrains Mono";

export type WatermarkPositionOption =
  | "top-right"
  | "top-left"
  | "bottom-right"
  | "hidden";

export interface MemberBrandKit {
  userId: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  surfaceColor: string;
  displayFont: DisplayFontOption;
  bodyFont: BodyFontOption;
  subtitlePreset: SubtitleStyle;
  defaultVoiceEngine: "edge_tts" | "elevenlabs";
  defaultVoiceId: string;
  watermarkText: string;
  watermarkPosition: WatermarkPositionOption;
  watermarkOpacity: number;
  safeZoneGuides: boolean;
  syncActiveProjects: boolean;
  updatedAt: string;
}

export const DEFAULT_BRAND_KIT_VALUES = {
  primaryColor: "#FF4F28",
  secondaryColor: "#F59E0B",
  accentColor: "#10B981",
  surfaceColor: "#09090B",
  displayFont: "Space Grotesk" as DisplayFontOption,
  bodyFont: "Plus Jakarta Sans" as BodyFontOption,
  subtitlePreset: "karaoke_highlight" as SubtitleStyle,
  defaultVoiceEngine: "edge_tts" as const,
  defaultVoiceId: "en-US-ChristopherNeural",
  watermarkPosition: "top-right" as WatermarkPositionOption,
  watermarkOpacity: 70,
  safeZoneGuides: true,
  syncActiveProjects: true,
};

function ensureBrandKitColumns() {
  const db = getDb();
  const cols = db.prepare("PRAGMA table_info(brand_kits)").all() as Array<{
    name: string;
  }>;
  const names = new Set(cols.map((c) => c.name));

  if (!names.has("surface_color")) {
    db.exec(
      "ALTER TABLE brand_kits ADD COLUMN surface_color TEXT NOT NULL DEFAULT '#09090B'"
    );
  }
  if (!names.has("body_font")) {
    db.exec(
      "ALTER TABLE brand_kits ADD COLUMN body_font TEXT NOT NULL DEFAULT 'Plus Jakarta Sans'"
    );
  }
  if (!names.has("watermark_opacity")) {
    db.exec(
      "ALTER TABLE brand_kits ADD COLUMN watermark_opacity INTEGER NOT NULL DEFAULT 70"
    );
  }
  if (!names.has("safe_zone_guides")) {
    db.exec(
      "ALTER TABLE brand_kits ADD COLUMN safe_zone_guides INTEGER NOT NULL DEFAULT 1"
    );
  }
  if (!names.has("sync_active_projects")) {
    db.exec(
      "ALTER TABLE brand_kits ADD COLUMN sync_active_projects INTEGER NOT NULL DEFAULT 1"
    );
  }
}

export function getMemberBrandKit(
  userId: string,
  fallbackWatermark = "@animora_creator"
): MemberBrandKit {
  ensureBrandKitColumns();
  const db = getDb();
  const nowIso = new Date().toISOString();

  let row = db
    .prepare("SELECT * FROM brand_kits WHERE user_id = ? LIMIT 1")
    .get(userId) as Record<string, unknown> | undefined;

  if (!row) {
    db.prepare(
      `INSERT INTO brand_kits (
        user_id, primary_color, secondary_color, accent_color, surface_color,
        display_font, body_font, subtitle_preset, default_voice_engine,
        default_voice_id, watermark_text, watermark_position,
        watermark_opacity, safe_zone_guides, sync_active_projects, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      userId,
      DEFAULT_BRAND_KIT_VALUES.primaryColor,
      DEFAULT_BRAND_KIT_VALUES.secondaryColor,
      DEFAULT_BRAND_KIT_VALUES.accentColor,
      DEFAULT_BRAND_KIT_VALUES.surfaceColor,
      DEFAULT_BRAND_KIT_VALUES.displayFont,
      DEFAULT_BRAND_KIT_VALUES.bodyFont,
      DEFAULT_BRAND_KIT_VALUES.subtitlePreset,
      DEFAULT_BRAND_KIT_VALUES.defaultVoiceEngine,
      DEFAULT_BRAND_KIT_VALUES.defaultVoiceId,
      fallbackWatermark,
      DEFAULT_BRAND_KIT_VALUES.watermarkPosition,
      DEFAULT_BRAND_KIT_VALUES.watermarkOpacity,
      1,
      1,
      nowIso
    );

    row = db
      .prepare("SELECT * FROM brand_kits WHERE user_id = ? LIMIT 1")
      .get(userId) as Record<string, unknown>;
  }

  return {
    userId,
    primaryColor: String(row.primary_color || DEFAULT_BRAND_KIT_VALUES.primaryColor).toUpperCase(),
    secondaryColor: String(
      row.secondary_color || DEFAULT_BRAND_KIT_VALUES.secondaryColor
    ).toUpperCase(),
    accentColor: String(row.accent_color || DEFAULT_BRAND_KIT_VALUES.accentColor).toUpperCase(),
    surfaceColor: String(row.surface_color || DEFAULT_BRAND_KIT_VALUES.surfaceColor).toUpperCase(),
    displayFont: (row.display_font ||
      DEFAULT_BRAND_KIT_VALUES.displayFont) as DisplayFontOption,
    bodyFont: (row.body_font || DEFAULT_BRAND_KIT_VALUES.bodyFont) as BodyFontOption,
    subtitlePreset: (row.subtitle_preset ||
      DEFAULT_BRAND_KIT_VALUES.subtitlePreset) as SubtitleStyle,
    defaultVoiceEngine:
      row.default_voice_engine === "elevenlabs" ? "elevenlabs" : "edge_tts",
    defaultVoiceId: String(
      row.default_voice_id || DEFAULT_BRAND_KIT_VALUES.defaultVoiceId
    ),
    watermarkText: String(row.watermark_text || fallbackWatermark),
    watermarkPosition: (row.watermark_position ||
      DEFAULT_BRAND_KIT_VALUES.watermarkPosition) as WatermarkPositionOption,
    watermarkOpacity: Math.min(
      100,
      Math.max(15, Number(row.watermark_opacity ?? DEFAULT_BRAND_KIT_VALUES.watermarkOpacity))
    ),
    safeZoneGuides: row.safe_zone_guides === undefined ? true : Boolean(row.safe_zone_guides),
    syncActiveProjects:
      row.sync_active_projects === undefined ? true : Boolean(row.sync_active_projects),
    updatedAt: String(row.updated_at || nowIso),
  };
}

export function countMemberDraftProjects(userId: string): number {
  const db = getDb();
  const row = db
    .prepare(
      "SELECT COUNT(*) as cnt FROM video_projects WHERE user_id = ? AND status = 'draft'"
    )
    .get(userId) as { cnt: number } | undefined;
  return Number(row?.cnt || 0);
}

export function updateMemberBrandKit(
  userId: string,
  patch: Partial<Omit<MemberBrandKit, "userId" | "updatedAt">>
): {
  brandKit: MemberBrandKit;
  syncedProjectsCount: number;
} {
  ensureBrandKitColumns();
  const current = getMemberBrandKit(userId);
  const nowIso = new Date().toISOString();

  const chosenVoice = patch.defaultVoiceId
    ? VOICE_CATALOG.find((v) => v.voiceId === patch.defaultVoiceId)
    : VOICE_CATALOG.find((v) => v.voiceId === current.defaultVoiceId);

  const nextVoiceId = chosenVoice?.voiceId || current.defaultVoiceId;
  const nextVoiceEngine =
    patch.defaultVoiceEngine || chosenVoice?.provider || current.defaultVoiceEngine;

  const next: MemberBrandKit = {
    userId,
    primaryColor: (patch.primaryColor || current.primaryColor).toUpperCase(),
    secondaryColor: (patch.secondaryColor || current.secondaryColor).toUpperCase(),
    accentColor: (patch.accentColor || current.accentColor).toUpperCase(),
    surfaceColor: (patch.surfaceColor || current.surfaceColor).toUpperCase(),
    displayFont: patch.displayFont || current.displayFont,
    bodyFont: patch.bodyFont || current.bodyFont,
    subtitlePreset: patch.subtitlePreset || current.subtitlePreset,
    defaultVoiceEngine: nextVoiceEngine,
    defaultVoiceId: nextVoiceId,
    watermarkText:
      patch.watermarkText !== undefined ? patch.watermarkText.trim() : current.watermarkText,
    watermarkPosition: patch.watermarkPosition || current.watermarkPosition,
    watermarkOpacity:
      patch.watermarkOpacity !== undefined
        ? Math.min(100, Math.max(15, Math.round(patch.watermarkOpacity)))
        : current.watermarkOpacity,
    safeZoneGuides:
      patch.safeZoneGuides !== undefined ? patch.safeZoneGuides : current.safeZoneGuides,
    syncActiveProjects:
      patch.syncActiveProjects !== undefined
        ? patch.syncActiveProjects
        : current.syncActiveProjects,
    updatedAt: nowIso,
  };

  const db = getDb();
  let syncedProjectsCount = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `UPDATE brand_kits
       SET primary_color = ?, secondary_color = ?, accent_color = ?, surface_color = ?,
           display_font = ?, body_font = ?, subtitle_preset = ?,
           default_voice_engine = ?, default_voice_id = ?,
           watermark_text = ?, watermark_position = ?, watermark_opacity = ?,
           safe_zone_guides = ?, sync_active_projects = ?, updated_at = ?
       WHERE user_id = ?`
    ).run(
      next.primaryColor,
      next.secondaryColor,
      next.accentColor,
      next.surfaceColor,
      next.displayFont,
      next.bodyFont,
      next.subtitlePreset,
      next.defaultVoiceEngine,
      next.defaultVoiceId,
      next.watermarkText,
      next.watermarkPosition,
      next.watermarkOpacity,
      next.safeZoneGuides ? 1 : 0,
      next.syncActiveProjects ? 1 : 0,
      nowIso,
      userId
    );

    if (next.syncActiveProjects) {
      const syncRes = db
        .prepare(
          `UPDATE video_projects
           SET subtitle_style = ?, voice_engine = ?, voice_id = ?, updated_at = ?
           WHERE user_id = ? AND status = 'draft'`
        )
        .run(
          next.subtitlePreset,
          next.defaultVoiceEngine === "elevenlabs" ? "edge_tts" : next.defaultVoiceEngine,
          next.defaultVoiceEngine === "elevenlabs"
            ? chosenVoice?.fallbackEdgeVoiceId || "en-US-ChristopherNeural"
            : next.defaultVoiceId,
          nowIso,
          userId
        );
      syncedProjectsCount = Number(syncRes.changes || 0);
    }

    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  }

  return {
    brandKit: getMemberBrandKit(userId),
    syncedProjectsCount,
  };
}

export function resetMemberBrandKit(
  userId: string,
  defaultWatermark: string
): MemberBrandKit {
  const { brandKit } = updateMemberBrandKit(userId, {
    ...DEFAULT_BRAND_KIT_VALUES,
    watermarkText: defaultWatermark,
  });
  return brandKit;
}
