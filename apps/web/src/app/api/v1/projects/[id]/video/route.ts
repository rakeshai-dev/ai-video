import fs from "node:fs";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getUserProjectById } from "@/lib/projects";
import { getRenderOutputPathForUser } from "@/lib/render-engine";

function toWebStream(nodeStream: fs.ReadStream): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      nodeStream.on("data", (chunk) => {
        controller.enqueue(
          typeof chunk === "string" ? Buffer.from(chunk) : new Uint8Array(chunk)
        );
      });
      nodeStream.on("end", () => controller.close());
      nodeStream.on("error", (err) => controller.error(err));
    },
    cancel() {
      nodeStream.destroy();
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const project = getUserProjectById(user.id, id);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found in your isolated workspace." },
      { status: 404 }
    );
  }

  const { searchParams } = new URL(request.url);
  const renderId = searchParams.get("renderId");
  const download = searchParams.get("download") === "1";

  const resolved = getRenderOutputPathForUser(user.id, id, renderId);
  if (!resolved || !fs.existsSync(resolved.filePath)) {
    return NextResponse.json(
      { error: "No rendered MP4 file found for this project yet." },
      { status: 404 }
    );
  }

  const stat = fs.statSync(resolved.filePath);
  const fileSize = stat.size;
  const range = request.headers.get("range");

  if (range && !download) {
    const match = /^bytes=(\d+)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const start = Number.parseInt(match[1], 10);
    const requestedEnd = match[2]
      ? Number.parseInt(match[2], 10)
      : Math.min(start + 1024 * 1024 - 1, fileSize - 1);
    const end = Math.min(requestedEnd, fileSize - 1);

    if (
      Number.isNaN(start) ||
      Number.isNaN(end) ||
      start < 0 ||
      start >= fileSize ||
      start > end
    ) {
      return new NextResponse(null, {
        status: 416,
        headers: { "Content-Range": `bytes */${fileSize}` },
      });
    }

    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(resolved.filePath, { start, end });
    return new NextResponse(toWebStream(stream), {
      status: 206,
      headers: {
        "Content-Range": `bytes ${start}-${end}/${fileSize}`,
        "Accept-Ranges": "bytes",
        "Content-Length": String(chunkSize),
        "Content-Type": "video/mp4",
        "Cache-Control": "private, max-age=60",
      },
    });
  }

  const fullStream = fs.createReadStream(resolved.filePath);
  return new NextResponse(toWebStream(fullStream), {
    status: 200,
    headers: {
      "Content-Type": "video/mp4",
      "Content-Length": String(fileSize),
      "Accept-Ranges": "bytes",
      "Cache-Control": "private, no-cache",
      ...(download
        ? {
            "Content-Disposition": `attachment; filename="${resolved.downloadFileName}"`,
          }
        : {}),
    },
  });
}
