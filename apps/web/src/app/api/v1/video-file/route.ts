import fs from "node:fs";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";

const VIDEO_MAP: Record<string, string> = {
  solar: "solar-explainer-video.mp4",
  prototype: "prototype-video.mp4",
};

function toWebStream(nodeStream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => {
        controller.enqueue(typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk));
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

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
    const match = /^bytes=(\d+)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const start = Number.parseInt(match[1], 10);
    const requestedEnd = match[2] ? Number.parseInt(match[2], 10) : Math.min(start + 1024 * 1024 - 1, fileSize - 1);
    const end = Math.min(requestedEnd, fileSize - 1);

    if (Number.isNaN(start) || Number.isNaN(end) || start < 0 || start >= fileSize || start > end) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end });

    return new NextResponse(toWebStream(stream), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
      },
    });
  }

  const fullStream = fs.createReadStream(filePath);
  return new NextResponse(toWebStream(fullStream), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      ...(download ? { "Content-Disposition": `attachment; filename="${fileName}"` } : {}),
    },
  });
}
