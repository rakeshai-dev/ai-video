import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = process.env.ANIMORA_DB_PATH
  ? path.resolve(process.env.ANIMORA_DB_PATH)
  : path.join(DATA_DIR, "animora-studio.sqlite");

let dbInstance: DatabaseSync | null = null;

function openAndInitializeDatabase(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      PRAGMA journal_mode = WAL;
      PRAGMA foreign_keys = ON;
    `);
    const check = db.prepare("PRAGMA quick_check").get() as { quick_check?: string } | undefined;
    if (check?.quick_check && check.quick_check !== "ok") {
      throw new Error(`SQLite quick_check failed: ${check.quick_check}`);
    }
    return db;
  } catch (err) {
    try {
      db.close();
    } catch {
      // ignore close error
    }
    throw err;
  }
}

/**
 * Returns a singleton SQLite database connection powered by Node.js built-in `node:sqlite`.
 * Includes automatic stale WAL/SHM sidecar recovery after abrupt process termination.
 */
export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

  let db: DatabaseSync;
  try {
    db = openAndInitializeDatabase(DB_PATH);
  } catch {
    // Self-heal mismatched or truncated -shm / -wal sidecar files after abrupt crash
    for (const suffix of ["-shm", "-wal"]) {
      const sidecar = `${DB_PATH}${suffix}`;
      if (fs.existsSync(sidecar)) {
        try {
          fs.rmSync(sidecar, { force: true });
        } catch {
          // ignore if locked
        }
      }
    }
    db = openAndInitializeDatabase(DB_PATH);
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      otp_code TEXT,
      otp_expires_at TEXT,
      reset_token TEXT,
      reset_expires_at TEXT,
      failed_login_attempts INTEGER NOT NULL DEFAULT 0,
      locked_until TEXT,
      plan_tier TEXT NOT NULL DEFAULT 'starter_free',
      credits_balance INTEGER NOT NULL DEFAULT 15,
      workspace_slug TEXT UNIQUE,
      timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
      niche TEXT NOT NULL DEFAULT 'STEM & Science',
      otp_attempts INTEGER NOT NULL DEFAULT 0,
      demo_seeded INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT UNIQUE NOT NULL,
      device_label TEXT NOT NULL DEFAULT 'Web Browser',
      ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS credit_ledger (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      delta INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reason TEXT NOT NULL,
      project_id TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS brand_kits (
      user_id TEXT PRIMARY KEY,
      primary_color TEXT NOT NULL DEFAULT '#FF4F28',
      secondary_color TEXT NOT NULL DEFAULT '#F59E0B',
      accent_color TEXT NOT NULL DEFAULT '#10B981',
      display_font TEXT NOT NULL DEFAULT 'Space Grotesk',
      subtitle_preset TEXT NOT NULL DEFAULT 'karaoke_highlight',
      default_voice_engine TEXT NOT NULL DEFAULT 'edge_tts',
      default_voice_id TEXT NOT NULL DEFAULT 'en-US-ChristopherNeural',
      watermark_text TEXT NOT NULL DEFAULT '@animora_creator',
      watermark_position TEXT NOT NULL DEFAULT 'top-right',
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS social_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'instagram',
      ig_handle TEXT NOT NULL,
      account_type TEXT NOT NULL DEFAULT 'CREATOR',
      encrypted_token TEXT NOT NULL,
      sandbox_mode INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'active',
      token_expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS video_projects (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      topic_prompt TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL DEFAULT '9:16',
      duration_sec INTEGER NOT NULL DEFAULT 60,
      primary_template TEXT NOT NULL DEFAULT 'diagram_flow',
      voice_engine TEXT NOT NULL DEFAULT 'edge_tts',
      voice_id TEXT NOT NULL DEFAULT 'en-US-ChristopherNeural',
      subtitle_style TEXT NOT NULL DEFAULT 'karaoke_highlight',
      voice_speed REAL NOT NULL DEFAULT 1.0,
      status TEXT NOT NULL DEFAULT 'draft',
      scenes_json TEXT NOT NULL DEFAULT '[]',
      mp4_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS renders (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      aspect_ratio TEXT NOT NULL DEFAULT '9:16',
      fps INTEGER NOT NULL DEFAULT 30,
      status TEXT NOT NULL DEFAULT 'queued',
      progress_pct INTEGER NOT NULL DEFAULT 0,
      current_step TEXT NOT NULL DEFAULT '',
      output_mp4_path TEXT,
      file_size_bytes INTEGER NOT NULL DEFAULT 0,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      total_frames INTEGER NOT NULL DEFAULT 0,
      credits_charged INTEGER NOT NULL DEFAULT 1,
      refund_tx_id TEXT,
      error_message TEXT,
      worker_trace TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      completed_at TEXT,
      FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS scheduled_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      project_id TEXT NOT NULL,
      ig_handle TEXT NOT NULL,
      caption TEXT NOT NULL,
      hashtags TEXT NOT NULL DEFAULT '',
      scheduled_for TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'scheduled',
      ig_container_id TEXT,
      error_message TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (project_id) REFERENCES video_projects(id) ON DELETE CASCADE
    );
  `);

  // Idempotent schema migrations for pre-existing local SQLite files
  const userCols = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  const colNames = new Set(userCols.map((c) => c.name));
  if (!colNames.has("otp_attempts")) {
    db.exec("ALTER TABLE users ADD COLUMN otp_attempts INTEGER NOT NULL DEFAULT 0");
  }
  if (!colNames.has("demo_seeded")) {
    db.exec("ALTER TABLE users ADD COLUMN demo_seeded INTEGER NOT NULL DEFAULT 0");
  }

  const projCols = db.prepare("PRAGMA table_info(video_projects)").all() as Array<{ name: string }>;
  const projColNames = new Set(projCols.map((c) => c.name));
  if (!projColNames.has("voice_speed")) {
    db.exec("ALTER TABLE video_projects ADD COLUMN voice_speed REAL NOT NULL DEFAULT 1.0");
  }

  const socCols = db.prepare("PRAGMA table_info(social_accounts)").all() as Array<{ name: string }>;
  const socColNames = new Set(socCols.map((c) => c.name));
  if (!socColNames.has("display_name")) {
    db.exec("ALTER TABLE social_accounts ADD COLUMN display_name TEXT NOT NULL DEFAULT ''");
  }
  if (!socColNames.has("ig_user_id")) {
    db.exec("ALTER TABLE social_accounts ADD COLUMN ig_user_id TEXT NOT NULL DEFAULT ''");
  }
  if (!socColNames.has("fb_page_name")) {
    db.exec("ALTER TABLE social_accounts ADD COLUMN fb_page_name TEXT NOT NULL DEFAULT ''");
  }
  if (!socColNames.has("fb_page_id")) {
    db.exec("ALTER TABLE social_accounts ADD COLUMN fb_page_id TEXT NOT NULL DEFAULT ''");
  }
  if (!socColNames.has("followers_count")) {
    db.exec("ALTER TABLE social_accounts ADD COLUMN followers_count INTEGER NOT NULL DEFAULT 14200");
  }
  if (!socColNames.has("scopes_json")) {
    db.exec(
      `ALTER TABLE social_accounts ADD COLUMN scopes_json TEXT NOT NULL DEFAULT '["instagram_basic","instagram_content_publish","pages_show_list","pages_read_engagement"]'`
    );
  }
  if (!socColNames.has("updated_at")) {
    db.exec("ALTER TABLE social_accounts ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
  }

  const spCols = db.prepare("PRAGMA table_info(scheduled_posts)").all() as Array<{ name: string }>;
  const spColNames = new Set(spCols.map((c) => c.name));
  if (!spColNames.has("render_id")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN render_id TEXT");
  }
  if (!spColNames.has("ig_media_id")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN ig_media_id TEXT");
  }
  if (!spColNames.has("ig_permalink")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN ig_permalink TEXT");
  }
  if (!spColNames.has("timezone")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata'");
  }
  if (!spColNames.has("doi_auto_comment")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN doi_auto_comment INTEGER NOT NULL DEFAULT 0");
  }
  if (!spColNames.has("published_at")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN published_at TEXT");
  }
  if (!spColNames.has("updated_at")) {
    db.exec("ALTER TABLE scheduled_posts ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
  }

  dbInstance = db;
  return dbInstance;
}
