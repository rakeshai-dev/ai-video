import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import {
  exportMemberLedgerCsv,
  getMemberBillingOverview,
  type LedgerCategoryFilter,
} from "@/lib/billing";

const filterSchema = z.enum(["all", "grants", "renders", "refunds"]).catch("all");

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const filter = filterSchema.parse(searchParams.get("filter") ?? "all") as LedgerCategoryFilter;
    const query = (searchParams.get("q") ?? "").trim();
    const format = (searchParams.get("format") ?? "json").toLowerCase();

    if (format === "csv") {
      const csv = exportMemberLedgerCsv(user.id, { filter, query });
      const dateStamp = new Date().toISOString().slice(0, 10);
      const filename = `animora-credit-ledger-${user.workspaceSlug || user.id}-${dateStamp}.csv`;

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${filename}"`,
          "Cache-Control": "no-store",
        },
      });
    }

    const overview = getMemberBillingOverview(user.id, { filter, query });
    return NextResponse.json(overview, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load credit ledger." },
      { status: 500 }
    );
  }
}
