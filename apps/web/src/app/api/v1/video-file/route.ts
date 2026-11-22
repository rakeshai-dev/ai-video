import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const VIDEO_MAP: Record<string, string> = {
  solar: "solar-explainer-video.mp4",
  prototype: "prototype-video.mp4",
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const key = searchParams.get("name") || "solar";
  const download = searchParams.get("download") === "1";

  const fileName = VIDEO_MAP[key] || VIDEO_MAP.solar;
  const repoRoot = path.resolve(process.cwd(), "..", "..");
  const filePath = path.join(repoRoot, fileName);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json(
      { error: "Rendered prototype MP4 file not found on disk." },
      { status: 404 }
    );
  }

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = request.headers.get("range");

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : Math.min(start + 1024 * 1024 - 1, fileSize - 1);
    const chunkSize = end - start + 1;

    const stream = fs.createReadStream(filePath, { start, end });
    const webStream = new ReadableStream({
      start(controller) {
        stream.on("data", (chunk) => controller.enqueue(chunk));
        stream.on("end", () => controller.close());
        stream.on("error", (err) => controller.error(err));
      },
      cancel() {
        stream.destroy();
      },
    });

    return new NextResponse(webStream, {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
      },
    });
  }

  const fileBuffer = fs.readFileSync(filePath);
  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      ...(download ? { "Content-Disposition": `attachment; filename="${fileName}"` } : {}),
    },
  });
}
