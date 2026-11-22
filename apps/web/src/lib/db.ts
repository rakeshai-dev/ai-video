import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const DATA_DIR = path.resolve(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "animora.sqlite");

let dbInstance: DatabaseSync | null = null;

/**
 * Returns a singleton SQLite database connection powered by Node.js built-in `node:sqlite`.
 * Schema aligns strictly with DB_DESIGN.md (multi-tenant `user_id` scoping + immutable credit ledger).
 */
export function getDb(): DatabaseSync {
  if (dbInstance) return dbInstance;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const db = new DatabaseSync(DB_PATH);

  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

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
      status TEXT NOT NULL DEFAULT 'draft',
      scenes_json TEXT NOT NULL DEFAULT '[]',
      mp4_path TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
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

  dbInstance = db;
  return dbInstance;
}
