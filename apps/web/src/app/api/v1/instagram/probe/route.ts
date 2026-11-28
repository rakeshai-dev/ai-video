import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { runInstagramHandshakeProbe } from "@/lib/instagram";

export async function POST() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const probe = runInstagramHandshakeProbe(user.id);
  return NextResponse.json(probe);
}
