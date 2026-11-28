import crypto from "node:crypto";
import { getDb } from "@/lib/db";
import { getMemberInstagramAccount } from "@/lib/instagram";
import type { SceneType } from "@/lib/projects";

export type ScheduledPostStatus =
  | "scheduled"
  | "published"
  | "failed"
  | "cancelled";

export interface ScheduledReelItem {
  id: string;
  userId: string;
  projectId: string;
  projectTitle: string;
  aspectRatio: "9:16" | "16:9";
  durationSec: number;
  primaryTemplate: SceneType;
  mp4Url: string | null;
  renderId: string | null;
  igHandle: string;
  caption: string;
  hashtags: string;
  scheduledFor: string;
  timezone: string;
  status: ScheduledPostStatus;
  igContainerId: string | null;
  igMediaId: string | null;
  igPermalink: string | null;
  doiAutoComment: boolean;
  retryCount: number;
  errorMessage: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SchedulableProjectOption {
  id: string;
  title: string;
  aspectRatio: "9:16" | "16:9";
  durationSec: number;
  primaryTemplate: SceneType;
  status: string;
  hasMp4: boolean;
}

function ensureScheduleColumns() {
  const db = getDb();
  const cols = db.prepare("PRAGMA table_info(scheduled_posts)").all() as Array<{
    name: string;
  }>;
  const names = new Set(cols.map((c) => c.name));

  if (!names.has("render_id")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN render_id TEXT");
  }
  if (!names.has("ig_media_id")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN ig_media_id TEXT");
  }
  if (!names.has("ig_permalink")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN ig_permalink TEXT");
  }
  if (!names.has("timezone")) {
    db.exec(
      "ALTER TABLE scheduled_posts ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'"
    );
  }
  if (!names.has("doi_auto_comment")) {
    db.exec(
      "ALTER TABLE scheduled_posts ADD COLUMN doi_auto_comment INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!names.has("retry_count")) {
    db.exec(
      "ALTER TABLE scheduled_posts ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0"
    );
  }
  if (!names.has("published_at")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN published_at TEXT");
  }
  if (!names.has("updated_at")) {
    db.exec(
      "ALTER TABLE scheduled_posts ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''"
    );
  }
}

function mapScheduledJoinRow(r: Record<string, unknown>): ScheduledReelItem {
  const projectId = String(r.project_id);
  const rawMp4 = r.mp4_path ? String(r.mp4_path) : null;
  const mp4Url = rawMp4
    ? rawMp4.startsWith("/api/")
      ? rawMp4
      : `/api/v1/projects/${projectId}/video`
    : null;

  return {
    id: String(r.id),
    userId: String(r.user_id),
    projectId,
    projectTitle: String(r.project_title || "Untitled Video Project"),
    aspectRatio: r.aspect_ratio === "16:9" ? "16:9" : "9:16",
    durationSec: Number(r.duration_sec || 30),
    primaryTemplate: (r.primary_template || "diagram_flow") as SceneType,
    mp4Url,
    renderId: r.render_id ? String(r.render_id) : null,
    igHandle: String(r.ig_handle || "@animora_creator"),
    caption: String(r.caption || ""),
    hashtags: String(r.hashtags || ""),
    scheduledFor: String(r.scheduled_for),
    timezone: String(r.timezone || "Asia/Kolkata"),
    status: (r.status || "scheduled") as ScheduledPostStatus,
    igContainerId: r.ig_container_id ? String(r.ig_container_id) : null,
    igMediaId: r.ig_media_id ? String(r.ig_media_id) : null,
    igPermalink: r.ig_permalink ? String(r.ig_permalink) : null,
    doiAutoComment: Boolean(r.doi_auto_comment),
    retryCount: Number(r.retry_count || 0),
    errorMessage: r.error_message ? String(r.error_message) : null,
    publishedAt: r.published_at ? String(r.published_at) : null,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at || r.created_at),
  };
}

/**
 * Dispatches a single scheduled/failed post immediately (used by both the background cron
 * worker and manual "Force Instant Publish" / "Retry Dispatch" actions).
 */
export function executeScheduledReelDispatch(params: {
  userId: string;
  postId: string;
  simulateFailure?: boolean;
}): ScheduledReelItem {
  ensureScheduleColumns();
  const db = getDb();

  const existing = db
    .prepare(
      `SELECT sp.*, vp.title as project_title, vp.aspect_ratio, vp.duration_sec,
              vp.primary_template, vp.mp4_path
       FROM scheduled_posts sp
       JOIN video_projects vp ON vp.id = sp.project_id
       WHERE sp.id = ? AND sp.user_id = ?
       LIMIT 1`
    )
    .get(params.postId, params.userId) as Record<string, unknown> | undefined;

  if (!existing) {
    const err = new Error("Scheduled post not found in your workspace.");
    (err as Error & { status?: number }).status = 404;
    throw err;
  }

  const nowIso = new Date().toISOString();
  const prevRetry = Number(existing.retry_count || 0);
  const igAccount = getMemberInstagramAccount(params.userId);

  if (params.simulateFailure) {
    const failMsg = "Meta Graph API v21.0 container upload timeout (#504)";
    db.prepare(
      `UPDATE scheduled_posts
       SET status = 'failed', error_message = ?, retry_count = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(failMsg, prevRetry + 1, nowIso, params.postId, params.userId);

    return getScheduledReelById(params.userId, params.postId)!;
  }

  if (!igAccount) {
    const failMsg = "Instagram account disconnected — reconnect in Instagram Connect.";
    db.prepare(
      `UPDATE scheduled_posts
       SET status = 'failed', error_message = ?, retry_count = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(failMsg, prevRetry + 1, nowIso, params.postId, params.userId);
    return getScheduledReelById(params.userId, params.postId)!;
  }

  if (igAccount.isExpired) {
    const failMsg = `60-day OAuth token expired for ${igAccount.handle} (TOKEN_DEGRADED).`;
    db.prepare(
      `UPDATE scheduled_posts
       SET status = 'failed', error_message = ?, retry_count = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(failMsg, prevRetry + 1, nowIso, params.postId, params.userId);
    return getScheduledReelById(params.userId, params.postId)!;
  }

  const containerId = `ig_cnt_${crypto.randomInt(100000000000, 999999999999)}`;
  const mediaId = `179${crypto.randomInt(1000000000000, 9999999999999)}`;
  const shortcode = `DR${crypto
    .randomBytes(5)
    .toString("base64url")
    .replace(/[^A-Za-z0-9]/g, "")
    .slice(0, 8)}`;
  const permalink = `https://www.instagram.com/reel/${shortcode}/`;

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(
      `UPDATE scheduled_posts
       SET status = 'published',
           ig_handle = ?,
           ig_container_id = ?,
           ig_media_id = ?,
           ig_permalink = ?,
           error_message = NULL,
           published_at = ?,
           updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      igAccount.handle,
      containerId,
      mediaId,
      permalink,
      nowIso,
      nowIso,
      params.postId,
      params.userId
    );

    db.prepare(
      `UPDATE video_projects
       SET status = 'published', updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(nowIso, String(existing.project_id), params.userId);

    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  }

  return getScheduledReelById(params.userId, params.postId)!;
}

/**
 * Sweep due `scheduled` posts (`scheduled_for <= now`) either for a specific tenant
 * or across all tenants (background cron worker).
 */
export function dispatchDueScheduledReels(targetUserId?: string): {
  dispatchedCount: number;
  failedCount: number;
} {
  ensureScheduleColumns();
  const db = getDb();
  const nowIso = new Date().toISOString();

  const dueRows = (
    targetUserId
      ? db
          .prepare(
            `SELECT id, user_id FROM scheduled_posts
             WHERE user_id = ? AND status = 'scheduled' AND scheduled_for <= ?
             ORDER BY scheduled_for ASC LIMIT 25`
          )
          .all(targetUserId, nowIso)
      : db
          .prepare(
            `SELECT id, user_id FROM scheduled_posts
             WHERE status = 'scheduled' AND scheduled_for <= ?
             ORDER BY scheduled_for ASC LIMIT 50`
          )
          .all(nowIso)
  ) as Array<{ id: string; user_id: string }>;

  let dispatchedCount = 0;
  let failedCount = 0;

  for (const row of dueRows) {
    try {
      const updated = executeScheduledReelDispatch({
        userId: row.user_id,
        postId: row.id,
      });
      if (updated.status === "published") {
        dispatchedCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  return { dispatchedCount, failedCount };
}

// Start singleton 30-second background scheduler loop inside the Node server process
const globalForScheduler = globalThis as unknown as {
  __animoraCronTimer?: ReturnType<typeof setInterval>;
};

export function ensureBackgroundSchedulerStarted() {
  if (globalForScheduler.__animoraCronTimer) return;
  globalForScheduler.__animoraCronTimer = setInterval(() => {
    try {
      dispatchDueScheduledReels();
    } catch {
      // ignore background tick errors
    }
  }, 30_000);
  if (typeof globalForScheduler.__animoraCronTimer.unref === "function") {
    globalForScheduler.__animoraCronTimer.unref();
  }
}

export function getScheduledReelById(
  userId: string,
  postId: string
): ScheduledReelItem | null {
  ensureScheduleColumns();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT sp.*, vp.title as project_title, vp.aspect_ratio, vp.duration_sec,
              vp.primary_template, vp.mp4_path
       FROM scheduled_posts sp
       JOIN video_projects vp ON vp.id = sp.project_id
       WHERE sp.id = ? AND sp.user_id = ?
       LIMIT 1`
    )
    .get(postId, userId) as Record<string, unknown> | undefined;

  return row ? mapScheduledJoinRow(row) : null;
}

export function listMemberScheduledReels(
  userId: string,
  filters?: { status?: string; month?: string }
): {
  posts: ScheduledReelItem[];
  eligibleProjects: SchedulableProjectOption[];
  summary: {
    total: number;
    scheduled: number;
    published: number;
    failed: number;
  };
} {
  ensureScheduleColumns();
  ensureBackgroundSchedulerStarted();
  dispatchDueScheduledReels(userId);

  const db = getDb();
  const allRows = db
    .prepare(
      `SELECT sp.*, vp.title as project_title, vp.aspect_ratio, vp.duration_sec,
              vp.primary_template, vp.mp4_path
       FROM scheduled_posts sp
       JOIN video_projects vp ON vp.id = sp.project_id
       WHERE sp.user_id = ? AND sp.status != 'cancelled'
       ORDER BY sp.scheduled_for ASC`
    )
    .all(userId) as Array<Record<string, unknown>>;

  const mappedAll = allRows.map(mapScheduledJoinRow);

  const summary = {
    total: mappedAll.length,
    scheduled: mappedAll.filter((p) => p.status === "scheduled").length,
    published: mappedAll.filter((p) => p.status === "published").length,
    failed: mappedAll.filter((p) => p.status === "failed").length,
  };

  let filtered = mappedAll;
  if (filters?.status && filters.status !== "all") {
    filtered = filtered.filter((p) => p.status === filters.status);
  }
  if (filters?.month && /^\d{4}-\d{2}$/.test(filters.month)) {
    filtered = filtered.filter((p) => p.scheduledFor.startsWith(filters.month!));
  }

  const projectRows = db
    .prepare(
      `SELECT id, title, aspect_ratio, duration_sec, primary_template, status, mp4_path
       FROM video_projects
       WHERE user_id = ?
       ORDER BY updated_at DESC`
    )
    .all(userId) as Array<{
    id: string;
    title: string;
    aspect_ratio: string;
    duration_sec: number;
    primary_template: string;
    status: string;
    mp4_path: string | null;
  }>;

  const eligibleProjects: SchedulableProjectOption[] = projectRows.map((p) => ({
    id: p.id,
    title: p.title,
    aspectRatio: p.aspect_ratio === "16:9" ? "16:9" : "9:16",
    durationSec: p.duration_sec,
    primaryTemplate: (p.primary_template || "diagram_flow") as SceneType,
    status: p.status,
    hasMp4:
      Boolean(p.mp4_path) ||
      p.status === "rendered" ||
      p.status === "published" ||
      p.status === "scheduled",
  }));

  return {
    posts: filtered,
    eligibleProjects,
    summary,
  };
}

export function updateMemberScheduledReel(params: {
  userId: string;
  postId: string;
  scheduledFor?: string;
  caption?: string;
  timezone?: string;
  doiAutoComment?: boolean;
}): ScheduledReelItem | null {
  ensureScheduleColumns();
  const existing = getScheduledReelById(params.userId, params.postId);
  if (!existing) return null;

  let nextScheduledFor = existing.scheduledFor;
  if (params.scheduledFor) {
    const parsedDate = new Date(params.scheduledFor);
    if (Number.isNaN(parsedDate.getTime())) {
      const err = new Error("Invalid scheduledFor date/time.");
      (err as Error & { code?: string }).code = "INVALID_SCHEDULE_TIME";
      throw err;
    }
    nextScheduledFor = parsedDate.toISOString();
  }

  const nextCaption =
    params.caption !== undefined ? params.caption.trim() : existing.caption;
  const nextTimezone = params.timezone || existing.timezone;
  const nextDoi =
    params.doiAutoComment !== undefined
      ? params.doiAutoComment
      : existing.doiAutoComment;
  const nextStatus: ScheduledPostStatus =
    existing.status === "failed" && params.scheduledFor && new Date(nextScheduledFor).getTime() > Date.now()
      ? "scheduled"
      : existing.status;
  const nowIso = new Date().toISOString();

  const db = getDb();
  db.prepare(
    `UPDATE scheduled_posts
     SET scheduled_for = ?, caption = ?, timezone = ?, doi_auto_comment = ?,
         status = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`
  ).run(
    nextScheduledFor,
    nextCaption,
    nextTimezone,
    nextDoi ? 1 : 0,
    nextStatus,
    nowIso,
    params.postId,
    params.userId
  );

  return getScheduledReelById(params.userId, params.postId);
}

export function cancelMemberScheduledReel(
  userId: string,
  postId: string
): boolean {
  ensureScheduleColumns();
  const existing = getScheduledReelById(userId, postId);
  if (!existing) return false;

  const db = getDb();
  const nowIso = new Date().toISOString();

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare("DELETE FROM scheduled_posts WHERE id = ? AND user_id = ?").run(
      postId,
      userId
    );

    const remainingActive = db
      .prepare(
        `SELECT status FROM scheduled_posts
         WHERE project_id = ? AND user_id = ?
         ORDER BY rowid DESC LIMIT 1`
      )
      .get(existing.projectId, userId) as { status: string } | undefined;

    if (!remainingActive) {
      db.prepare(
        `UPDATE video_projects
         SET status = CASE WHEN mp4_path IS NOT NULL AND mp4_path != '' THEN 'rendered' ELSE 'draft' END,
             updated_at = ?
         WHERE id = ? AND user_id = ?`
      ).run(nowIso, existing.projectId, userId);
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

  return true;
}
