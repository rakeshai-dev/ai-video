import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export async function GET() {
  try {
    const db = getDb();
    const row = db
      .prepare("SELECT COUNT(*) as tableCount FROM sqlite_master WHERE type='table'")
      .get() as { tableCount: number };

    return NextResponse.json({
      service: "animora-studio-web",
      status: "healthy",
      database: "sqlite-wal-connected",
      tablesInitialized: row?.tableCount ?? 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        service: "animora-studio-web",
        status: "error",
        error: error instanceof Error ? error.message : "Database healthcheck failed",
      },
      { status: 500 }
    );
  }
}
