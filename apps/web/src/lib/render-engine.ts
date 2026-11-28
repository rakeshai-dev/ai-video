import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { getDb } from "@/lib/db";
import { VOICE_CATALOG } from "@/lib/ai-generator";
import { getUserProjectById, type SceneData } from "@/lib/projects";

export interface RenderJobRecord {
  id: string;
  projectId: string;
  userId: string;
  aspectRatio: "9:16" | "16:9";
  fps: number;
  status: "queued" | "rendering" | "completed" | "failed";
  progressPct: number;
  currentStep: string;
  outputMp4Url: string | null;
  fileSizeBytes: number;
  durationMs: number;
  totalFrames: number;
  creditsCharged: number;
  refundTxId: string | null;
  errorMessage: string | null;
  workerTrace: string[];
  createdAt: string;
  completedAt: string | null;
}

export interface CreditLedgerEntry {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  projectId: string | null;
  createdAt: string;
}

export class InsufficientCreditsError extends Error {
  requiredCredits: number;
  currentBalance: number;

  constructor(requiredCredits: number, currentBalance: number) {
    super(
      `Not enough credits to export 1080p MP4. Required: ${requiredCredits} credits, Current balance: ${currentBalance} credits.`
    );
    this.name = "InsufficientCreditsError";
    this.requiredCredits = requiredCredits;
    this.currentBalance = currentBalance;
  }
}

function ensureRendersSchema() {
  const db = getDb();
  db.exec(`
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
  `);
}

export function calculateRenderCreditCost(durationSec: number): {
  credits: number;
  tierLabel: string;
} {
  if (durationSec <= 35) {
    return { credits: 1, tierLabel: "30s Explainer Reel" };
  }
  if (durationSec <= 70) {
    return { credits: 2, tierLabel: "60s Explainer Reel" };
  }
  return { credits: 3, tierLabel: "90s Deep-Dive Reel" };
}

function getRepoPaths() {
  const cwd = process.cwd();
  const isAppsWeb =
    path.basename(cwd) === "web" && path.basename(path.dirname(cwd)) === "apps";
  const repoRoot = isAppsWeb ? path.resolve(cwd, "..", "..") : cwd;
  const webRoot = isAppsWeb ? cwd : path.join(repoRoot, "apps", "web");
  const engineRoot = path.join(repoRoot, "packages", "video-engine");
  const rendersDir = path.join(webRoot, "data", "renders");
  fs.mkdirSync(rendersDir, { recursive: true });
  return { repoRoot, webRoot, engineRoot, rendersDir };
}

function mapRenderRow(row: Record<string, unknown>): RenderJobRecord {
  let trace: string[] = [];
  try {
    const parsed = JSON.parse(String(row.worker_trace || "[]"));
    if (Array.isArray(parsed)) trace = parsed.map(String);
  } catch {
    trace = [];
  }

  const status = String(row.status || "queued") as RenderJobRecord["status"];
  const projectId = String(row.project_id);
  const id = String(row.id);
  const hasFile = Boolean(row.output_mp4_path);

  return {
    id,
    projectId,
    userId: String(row.user_id),
    aspectRatio: row.aspect_ratio === "16:9" ? "16:9" : "9:16",
    fps: Number(row.fps || 30),
    status,
    progressPct: Number(row.progress_pct || 0),
    currentStep: String(row.current_step || ""),
    outputMp4Url:
      status === "completed" && hasFile
        ? `/api/v1/projects/${projectId}/video?renderId=${encodeURIComponent(id)}`
        : null,
    fileSizeBytes: Number(row.file_size_bytes || 0),
    durationMs: Number(row.duration_ms || 0),
    totalFrames: Number(row.total_frames || 0),
    creditsCharged: Number(row.credits_charged || 1),
    refundTxId: row.refund_tx_id ? String(row.refund_tx_id) : null,
    errorMessage: row.error_message ? String(row.error_message) : null,
    workerTrace: trace,
    createdAt: String(row.created_at),
    completedAt: row.completed_at ? String(row.completed_at) : null,
  };
}

export function getLatestRenderForProject(
  userId: string,
  projectId: string
): RenderJobRecord | null {
  ensureRendersSchema();
  const db = getDb();
  const row = db
    .prepare(
      `SELECT * FROM renders
       WHERE project_id = ? AND user_id = ?
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(projectId, userId) as Record<string, unknown> | undefined;

  return row ? mapRenderRow(row) : null;
}

export function getRenderOutputPathForUser(
  userId: string,
  projectId: string,
  renderId?: string | null
): { filePath: string; downloadFileName: string } | null {
  ensureRendersSchema();
  const db = getDb();
  const { repoRoot } = getRepoPaths();

  if (renderId) {
    const row = db
      .prepare(
        `SELECT id, output_mp4_path FROM renders
         WHERE id = ? AND project_id = ? AND user_id = ? AND status = 'completed'
         LIMIT 1`
      )
      .get(renderId, projectId, userId) as
      | { id: string; output_mp4_path: string | null }
      | undefined;
    if (row?.output_mp4_path && fs.existsSync(row.output_mp4_path)) {
      return {
        filePath: row.output_mp4_path,
        downloadFileName: `animora-${projectId}-${row.id}.mp4`,
      };
    }
  }

  const latestCompleted = db
    .prepare(
      `SELECT id, output_mp4_path FROM renders
       WHERE project_id = ? AND user_id = ? AND status = 'completed'
       ORDER BY created_at DESC
       LIMIT 1`
    )
    .get(projectId, userId) as { id: string; output_mp4_path: string | null } | undefined;

  if (latestCompleted?.output_mp4_path && fs.existsSync(latestCompleted.output_mp4_path)) {
    return {
      filePath: latestCompleted.output_mp4_path,
      downloadFileName: `animora-${projectId}-${latestCompleted.id}.mp4`,
    };
  }

  // Support pre-seeded demo projects pointing to prototype/solar MP4s
  const project = getUserProjectById(userId, projectId);
  if (project?.mp4Path) {
    const fallbackName = project.mp4Path.includes("prototype")
      ? "prototype-video.mp4"
      : "solar-explainer-video.mp4";
    const candidate = path.join(repoRoot, fallbackName);
    if (fs.existsSync(candidate)) {
      return {
        filePath: candidate,
        downloadFileName: `animora-${projectId}.mp4`,
      };
    }
  }

  return null;
}

export function getRecentCreditLedger(
  userId: string,
  limit = 8
): CreditLedgerEntry[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, delta, balance_after, reason, project_id, created_at
       FROM credit_ledger
       WHERE user_id = ?
       ORDER BY rowid DESC
       LIMIT ?`
    )
    .all(userId, limit) as Array<{
    id: string;
    delta: number;
    balance_after: number;
    reason: string;
    project_id: string | null;
    created_at: string;
  }>;

  return rows.map((r) => ({
    id: r.id,
    delta: r.delta,
    balanceAfter: r.balance_after,
    reason: r.reason,
    projectId: r.project_id,
    createdAt: r.created_at,
  }));
}

function nowClock(): string {
  return new Date().toISOString().slice(11, 23);
}

function updateRenderProgress(
  renderId: string,
  progressPct: number,
  currentStep: string,
  traceLine?: string
) {
  const db = getDb();
  if (traceLine) {
    const existing = db
      .prepare("SELECT worker_trace FROM renders WHERE id = ?")
      .get(renderId) as { worker_trace: string } | undefined;
    let trace: string[] = [];
    try {
      trace = JSON.parse(existing?.worker_trace || "[]");
    } catch {
      trace = [];
    }
    trace.push(`[${nowClock()}] ${traceLine}`);
    if (trace.length > 24) trace = trace.slice(-24);
    db.prepare(
      `UPDATE renders SET progress_pct = ?, current_step = ?, worker_trace = ? WHERE id = ?`
    ).run(Math.round(progressPct), currentStep, JSON.stringify(trace), renderId);
  } else {
    db.prepare(
      `UPDATE renders SET progress_pct = ?, current_step = ? WHERE id = ?`
    ).run(Math.round(progressPct), currentStep, renderId);
  }
}

export function autoRefundFailedRender(
  renderId: string,
  userId: string,
  projectId: string,
  errorMessage: string,
  extraTraceLines: string[] = []
): { refundTxId: string | null; balanceAfter: number } {
  ensureRendersSchema();
  const db = getDb();
  const nowIso = new Date().toISOString();

  db.exec("BEGIN IMMEDIATE");
  try {
    const renderRow = db
      .prepare(
        `SELECT credits_charged, refund_tx_id, worker_trace FROM renders WHERE id = ? AND user_id = ?`
      )
      .get(renderId, userId) as
      | { credits_charged: number; refund_tx_id: string | null; worker_trace: string }
      | undefined;

    const userRow = db
      .prepare("SELECT credits_balance FROM users WHERE id = ?")
      .get(userId) as { credits_balance: number } | undefined;

    if (!renderRow || !userRow) {
      db.exec("ROLLBACK");
      return { refundTxId: null, balanceAfter: userRow?.credits_balance ?? 0 };
    }

    // Idempotency guard: never refund the same failed render twice
    if (renderRow.refund_tx_id) {
      db.exec("ROLLBACK");
      return {
        refundTxId: renderRow.refund_tx_id,
        balanceAfter: userRow.credits_balance,
      };
    }

    const refundAmount = Math.max(0, renderRow.credits_charged);
    const nextBalance = userRow.credits_balance + refundAmount;
    const refundTxId = `tx_ref_${crypto.randomBytes(4).toString("hex")}_refunded`;

    let trace: string[] = [];
    try {
      trace = JSON.parse(renderRow.worker_trace || "[]");
    } catch {
      trace = [];
    }
    for (const line of extraTraceLines) {
      trace.push(`[${nowClock()}] ${line}`);
    }
    trace.push(
      `[${nowClock()}] ERROR: ${errorMessage} — Triggering AutoRefundLedgerWorker()`
    );

    if (refundAmount > 0) {
      db.prepare(
        `UPDATE users SET credits_balance = ?, updated_at = ? WHERE id = ?`
      ).run(nextBalance, nowIso, userId);

      db.prepare(
        `INSERT INTO credit_ledger (id, user_id, delta, balance_after, reason, project_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).run(
        refundTxId,
        userId,
        refundAmount,
        nextBalance,
        `Auto-Refund: Failed 1080p Render (${renderId})`,
        projectId,
        nowIso
      );

      trace.push(
        `[${nowClock()}] LEDGER: Credited +${refundAmount} CR to ${userId} (${refundTxId}). Balance: ${nextBalance} CR [SUCCESS]`
      );
    }

    db.prepare(
      `UPDATE renders
       SET status = 'failed',
           current_step = 'Render interrupted — credits automatically refunded',
           refund_tx_id = ?,
           error_message = ?,
           worker_trace = ?,
           completed_at = ?
       WHERE id = ?`
    ).run(refundTxId, errorMessage, JSON.stringify(trace), nowIso, renderId);

    db.prepare(
      `UPDATE video_projects
       SET status = CASE WHEN mp4_path IS NOT NULL AND mp4_path != '' THEN 'rendered' ELSE 'draft' END,
           updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(nowIso, projectId, userId);

    db.exec("COMMIT");
    return { refundTxId, balanceAfter: nextBalance };
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore rollback error
    }
    throw err;
  }
}

// Track active in-process renders so duplicate clicks never double-spawn
const activeRenderPromises = new Map<string, Promise<void>>();

export async function startProjectRenderJob(options: {
  userId: string;
  projectId: string;
  aspectRatio?: "9:16" | "16:9";
  fps?: 30 | 60;
  simulateFailure?: boolean;
}): Promise<{
  render: RenderJobRecord;
  creditsDeducted: number;
  remainingBalance: number;
  alreadyRunning: boolean;
}> {
  ensureRendersSchema();
  const { userId, projectId } = options;
  const project = getUserProjectById(userId, projectId);
  if (!project) {
    throw new Error("Project not found in your isolated workspace.");
  }

  // Return existing active render job if already in progress
  const latest = getLatestRenderForProject(userId, projectId);
  if (
    latest &&
    (latest.status === "queued" || latest.status === "rendering") &&
    activeRenderPromises.has(latest.id)
  ) {
    const db = getDb();
    const u = db
      .prepare("SELECT credits_balance FROM users WHERE id = ?")
      .get(userId) as { credits_balance: number } | undefined;
    return {
      render: latest,
      creditsDeducted: 0,
      remainingBalance: u?.credits_balance ?? 0,
      alreadyRunning: true,
    };
  }

  const targetRatio = options.aspectRatio || project.aspectRatio;
  const targetFps = options.fps === 60 ? 60 : 30;
  const totalMs = project.scenes.reduce((acc, s) => acc + (s.duration_ms || 5000), 0);
  const totalSec = Math.max(10, Math.round(totalMs / 1000));
  const { credits: requiredCredits, tierLabel } = calculateRenderCreditCost(
    project.durationSec || totalSec
  );
  const totalFrames = Math.max(targetFps * 2, Math.ceil((totalMs / 1000) * targetFps));

  const renderId = `rnd_${crypto.randomBytes(6).toString("hex")}`;
  const chargeTxId = `tx_rnd_${crypto.randomBytes(5).toString("hex")}`;
  const nowIso = new Date().toISOString();
  const initialTrace = [
    `[${nowClock()}] STAGE_01_INIT: Created render job ${renderId} (${
      targetRatio === "9:16" ? "1080x1920" : "1920x1080"
    } @ ${targetFps}fps)`,
  ];

  const db = getDb();
  let remainingBalance = 0;

  db.exec("BEGIN IMMEDIATE");
  try {
    const userRow = db
      .prepare("SELECT credits_balance FROM users WHERE id = ?")
      .get(userId) as { credits_balance: number } | undefined;

    if (!userRow) {
      db.exec("ROLLBACK");
      throw new Error("User account not found.");
    }

    if (userRow.credits_balance < requiredCredits) {
      db.exec("ROLLBACK");
      throw new InsufficientCreditsError(requiredCredits, userRow.credits_balance);
    }

    remainingBalance = userRow.credits_balance - requiredCredits;
    initialTrace.push(
      `[${nowClock()}] LEDGER: Deducted -${requiredCredits} CR (${chargeTxId}) for ${tierLabel}. Balance: ${remainingBalance} CR`
    );

    db.prepare(
      `UPDATE users SET credits_balance = ?, updated_at = ? WHERE id = ?`
    ).run(remainingBalance, nowIso, userId);

    db.prepare(
      `INSERT INTO credit_ledger (id, user_id, delta, balance_after, reason, project_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(
      chargeTxId,
      userId,
      -requiredCredits,
      remainingBalance,
      `1080p MP4 Export: ${project.title.slice(0, 48)} (${tierLabel})`,
      projectId,
      nowIso
    );

    db.prepare(
      `INSERT INTO renders (
        id, project_id, user_id, aspect_ratio, fps, status, progress_pct,
        current_step, duration_ms, total_frames, credits_charged, worker_trace, created_at
      ) VALUES (?, ?, ?, ?, ?, 'rendering', 6, ?, ?, ?, ?, ?, ?)`
    ).run(
      renderId,
      projectId,
      userId,
      targetRatio,
      targetFps,
      `Stage 1/4: Preparing ${project.scenes.length} storyboard scenes...`,
      totalMs,
      totalFrames,
      requiredCredits,
      JSON.stringify(initialTrace),
      nowIso
    );

    db.prepare(
      `UPDATE video_projects
       SET status = 'rendering', aspect_ratio = ?, updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(targetRatio, nowIso, projectId, userId);

    db.exec("COMMIT");
  } catch (err) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // ignore
    }
    throw err;
  }

  const jobPromise = executeBackgroundRender({
    renderId,
    userId,
    projectId,
    aspectRatio: targetRatio,
    fps: targetFps,
    simulateFailure: Boolean(options.simulateFailure) && process.env.NODE_ENV !== "production",
  }).finally(() => {
    activeRenderPromises.delete(renderId);
  });

  activeRenderPromises.set(renderId, jobPromise);

  const createdRender = getLatestRenderForProject(userId, projectId)!;
  return {
    render: createdRender,
    creditsDeducted: requiredCredits,
    remainingBalance,
    alreadyRunning: false,
  };
}

function spawnAsync(
  cmd: string,
  args: string[],
  cwd: string,
  onLine?: (line: string) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderrTail = "";
    let outBuf = "";

    const handleChunk = (chunk: Buffer, isErr: boolean) => {
      const text = chunk.toString("utf8");
      if (isErr) {
        stderrTail = (stderrTail + text).slice(-1200);
      }
      outBuf += text;
      const lines = outBuf.split(/\r?\n|\r/);
      outBuf = lines.pop() || "";
      for (const ln of lines) {
        const trimmed = ln.trim();
        if (trimmed && onLine) onLine(trimmed);
      }
    };

    child.stdout?.on("data", (d: Buffer) => handleChunk(d, false));
    child.stderr?.on("data", (d: Buffer) => handleChunk(d, true));

    child.on("error", (err) => reject(err));
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Render worker exited with code ${code}${
              stderrTail ? `: ${stderrTail.trim().slice(-280)}` : ""
            }`
          )
        );
      }
    });
  });
}

async function executeBackgroundRender(params: {
  renderId: string;
  userId: string;
  projectId: string;
  aspectRatio: "9:16" | "16:9";
  fps: 30 | 60;
  simulateFailure: boolean;
}) {
  const { renderId, userId, projectId, aspectRatio, fps, simulateFailure } = params;
  const { engineRoot, rendersDir } = getRepoPaths();
  const ttsInPath = path.join(rendersDir, `${renderId}-tts-in.json`);
  const ttsOutPath = path.join(rendersDir, `${renderId}-tts-out.json`);
  const propsPath = path.join(rendersDir, `${renderId}-props.json`);
  const outputMp4Path = path.join(rendersDir, `${renderId}.mp4`);
  const publicAudioDir = path.join(engineRoot, "public", "audio");

  try {
    const project = getUserProjectById(userId, projectId);
    if (!project) {
      throw new Error("Project deleted before render started.");
    }

    const db = getDb();
    const brandRow = db
      .prepare(
        `SELECT primary_color, accent_color, display_font, watermark_text
         FROM brand_kits WHERE user_id = ?`
      )
      .get(userId) as
      | {
          primary_color: string;
          accent_color: string;
          display_font: string;
          watermark_text: string;
        }
      | undefined;

    const chosenPersona = VOICE_CATALOG.find((v) => v.voiceId === project.voiceId);
    const edgeVoiceId =
      chosenPersona?.provider === "edge_tts"
        ? chosenPersona.voiceId
        : chosenPersona?.fallbackEdgeVoiceId || "en-US-ChristopherNeural";

    // STAGE 1: Synthesize Neural Voiceover MP3s per scene
    updateRenderProgress(
      renderId,
      12,
      `Stage 1/4: Synthesizing neural voiceover (${edgeVoiceId})...`,
      `STAGE_02_TTS: Synthesizing ${project.scenes.length} scene voiceovers via ${edgeVoiceId}`
    );

    fs.writeFileSync(
      ttsInPath,
      JSON.stringify(
        {
          renderId,
          edgeVoiceId,
          voiceSpeed: project.voiceSpeed || 1.0,
          scenes: project.scenes,
        },
        null,
        2
      ),
      "utf8"
    );

    const synthScript = path.join(engineRoot, "scripts", "synthesize-scenes.mjs");
    await spawnAsync(
      process.execPath,
      [synthScript, `--input=${ttsInPath}`, `--output=${ttsOutPath}`],
      engineRoot,
      (line) => {
        if (line.startsWith("TTS_PROGRESS:")) {
          try {
            const info = JSON.parse(line.slice("TTS_PROGRESS:".length));
            const pct = 12 + Math.round((info.sceneIndex / info.totalScenes) * 24);
            updateRenderProgress(
              renderId,
              pct,
              `Stage 1/4: Voiceover synced for Scene ${info.sceneIndex} of ${info.totalScenes}`,
              `TTS_SYNC: Scene ${info.sceneIndex}/${info.totalScenes} (${(
                info.durationMs / 1000
              ).toFixed(1)}s${info.usedFallback ? " • cached neural sample" : ""})`
            );
          } catch {
            // ignore parse noise
          }
        }
      }
    );

    const ttsResult = JSON.parse(fs.readFileSync(ttsOutPath, "utf8")) as {
      scenes: SceneData[];
    };
    const enrichedScenes = ttsResult.scenes;

    // Optional fault-injection test hook for Stitch 14A Scenario 03 verification
    if (simulateFailure) {
      updateRenderProgress(
        renderId,
        52,
        "Stage 3/4: Rasterizing 1080p WebGL & SVG vector frames...",
        "STAGE_03_RASTER: Headless Chromium worker started on node-local-gpu01"
      );
      await new Promise((r) => setTimeout(r, 450));
      throw new Error(
        "Worker Error #504 — Headless Chromium Timeout during WebGL vector rasterization"
      );
    }

    // STAGE 2: Build Remotion Composition Payload
    const totalDurationMs = enrichedScenes.reduce(
      (sum, s) => sum + (s.duration_ms || 5000),
      0
    );
    const totalFrames = Math.max(fps * 2, Math.ceil((totalDurationMs / 1000) * fps));

    const remotionProps = {
      project: {
        project_id: project.id,
        title: project.title,
        category_preset: project.primaryTemplate,
        aspect_ratio: aspectRatio,
        fps,
        brand_kit: {
          primary_color: brandRow?.primary_color || "#FF4F28",
          accent_color: brandRow?.accent_color || "#F59E0B",
          font_family: brandRow?.display_font
            ? `${brandRow.display_font}, system-ui, sans-serif`
            : "Space Grotesk, Inter, system-ui, sans-serif",
          brand_name: brandRow?.watermark_text || "Animora Studio",
        },
        caption_config: {
          enabled: true,
          style: project.subtitleStyle,
          font_family: "Plus Jakarta Sans, Inter, system-ui, sans-serif",
          text_color: "#FFFFFF",
          highlight_color: "#F59E0B",
          position: "bottom_safe" as const,
        },
        scenes: enrichedScenes,
      },
    };

    fs.writeFileSync(propsPath, JSON.stringify(remotionProps, null, 2), "utf8");

    updateRenderProgress(
      renderId,
      40,
      `Stage 2/4: Bundling 5-template vector scenes (${totalFrames.toLocaleString()} frames)...`,
      `STAGE_03_BUNDLE: Prepared ${enrichedScenes.length} scenes (${(
        totalDurationMs / 1000
      ).toFixed(1)}s, ${totalFrames} frames)`
    );

    // STAGE 3: Execute Headless Remotion + FFmpeg H.264 MP4 Encode
    const remotionCli = path.join(
      engineRoot,
      "node_modules",
      "@remotion",
      "cli",
      "remotion-cli.js"
    );
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const cliArgs = [
      remotionCli,
      "render",
      "src/index.ts",
      "AnimoraVideo",
      outputMp4Path,
      `--props=${propsPath}`,
      "--concurrency=2",
    ];
    if (fs.existsSync(chromePath)) {
      cliArgs.push(`--browser-executable=${chromePath}`);
    }

    let lastReportedPct = 42;
    updateRenderProgress(
      renderId,
      lastReportedPct,
      `Stage 3/4: Rendering ${
        aspectRatio === "9:16" ? "1080×1920" : "1920×1080"
      } H.264 frames...`,
      `STAGE_04_ENCODE: Spawning headless Chromium + FFmpeg H.264 encoder`
    );

    await spawnAsync(process.execPath, cliArgs, engineRoot, (line) => {
      // Match Remotion frame output such as "Rendered 120/300" or "Encoded 120/300" or "(45%)"
      const ratioMatch = /(?:Rendered|Encoded|Stitching)\s+(\d+)\s*\/\s*(\d+)/i.exec(line);
      const pctMatch = /(\d{1,3})%/.exec(line);

      if (ratioMatch) {
        const done = Number(ratioMatch[1]);
        const total = Math.max(1, Number(ratioMatch[2]));
        const isEncode = /Encoded|Stitching/i.test(line);
        const mapped = isEncode
          ? 78 + Math.round((done / total) * 18)
          : 44 + Math.round((done / total) * 34);
        if (mapped > lastReportedPct) {
          lastReportedPct = Math.min(97, mapped);
          updateRenderProgress(
            renderId,
            lastReportedPct,
            isEncode
              ? `Stage 4/4: Multiplexing H.264 MP4 & AAC audio (${done}/${total})...`
              : `Stage 3/4: Rendering ${
                  aspectRatio === "9:16" ? "1080×1920" : "1920×1080"
                } frames (${done}/${total})...`
          );
        }
      } else if (pctMatch) {
        const rawPct = Math.min(100, Number(pctMatch[1]));
        const mapped = 42 + Math.round((rawPct / 100) * 52);
        if (mapped > lastReportedPct) {
          lastReportedPct = Math.min(96, mapped);
          updateRenderProgress(
            renderId,
            lastReportedPct,
            `Stage 3/4: Encoding 1080p H.264 MP4 (${rawPct}%)...`
          );
        }
      }
    });

    if (!fs.existsSync(outputMp4Path)) {
      throw new Error("FFmpeg completed without writing output MP4 file.");
    }
    const mp4Stat = fs.statSync(outputMp4Path);
    if (mp4Stat.size < 1024) {
      throw new Error("Rendered MP4 file was unexpectedly empty.");
    }

    // STAGE 4: Persist Completed Render & Update Project Status
    const completedIso = new Date().toISOString();
    const mp4ApiUrl = `/api/v1/projects/${projectId}/video?renderId=${encodeURIComponent(
      renderId
    )}`;
    const totalSecFinal = Math.max(10, Math.round(totalDurationMs / 1000));

    updateRenderProgress(
      renderId,
      100,
      "Pipeline Telemetry: 100% Complete — Final 1080p MP4 Ready!",
      `RENDER_OK: Wrote ${(mp4Stat.size / (1024 * 1024)).toFixed(2)} MB H.264 MP4 (${totalFrames} frames)`
    );

    db.prepare(
      `UPDATE renders
       SET status = 'completed',
           progress_pct = 100,
           current_step = 'Pipeline Telemetry: 100% Complete',
           output_mp4_path = ?,
           file_size_bytes = ?,
           duration_ms = ?,
           total_frames = ?,
           completed_at = ?
       WHERE id = ?`
    ).run(
      outputMp4Path,
      mp4Stat.size,
      totalDurationMs,
      totalFrames,
      completedIso,
      renderId
    );

    // Strip ephemeral audio/* relative path before saving enriched timestamps back to project
    const persistedScenes: SceneData[] = enrichedScenes.map((s) => ({
      scene_id: s.scene_id,
      order_index: s.order_index,
      scene_type: s.scene_type,
      narration_text: s.narration_text,
      on_screen_headline: s.on_screen_headline,
      visual_prompt: s.visual_prompt,
      animation_props: s.animation_props,
      word_timestamps: s.word_timestamps,
      duration_ms: s.duration_ms,
    }));

    db.prepare(
      `UPDATE video_projects
       SET status = 'rendered',
           mp4_path = ?,
           duration_sec = ?,
           scenes_json = ?,
           updated_at = ?
       WHERE id = ? AND user_id = ?`
    ).run(
      mp4ApiUrl,
      totalSecFinal,
      JSON.stringify(persistedScenes),
      completedIso,
      projectId,
      userId
    );
  } catch (err) {
    const errMsg =
      err instanceof Error ? err.message : "Unexpected 1080p render pipeline error";
    autoRefundFailedRender(renderId, userId, projectId, errMsg, [
      "WARN: Aborting headless Chromium / FFmpeg pipeline due to worker exception",
    ]);
  } finally {
    // Clean up temporary TTS MP3s and JSON prop files
    try {
      if (fs.existsSync(ttsInPath)) fs.unlinkSync(ttsInPath);
      if (fs.existsSync(ttsOutPath)) fs.unlinkSync(ttsOutPath);
      if (fs.existsSync(propsPath)) fs.unlinkSync(propsPath);
      if (fs.existsSync(publicAudioDir)) {
        for (const f of fs.readdirSync(publicAudioDir)) {
          if (f.startsWith(`rnd_${renderId}_`)) {
            fs.unlinkSync(path.join(publicAudioDir, f));
          }
        }
      }
    } catch {
      // ignore temp cleanup errors
    }
  }
}
