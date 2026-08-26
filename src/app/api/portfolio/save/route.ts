import { NextRequest, NextResponse } from "next/server";
import { parseTrades, parseCorporateActions, CorporateAction } from "@/lib/portfolioEngine";
import { portfolioStore } from "@/lib/portfolioStore";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const portfolioId = formData.get("portfolioId") as string | null;
    const tradesFile = formData.get("trades") as File | null;
    const actionsFile = formData.get("actions") as File | null;

    if (!portfolioId) {
      return NextResponse.json({ error: "portfolioId is required" }, { status: 400 });
    }
    if (!tradesFile) {
      return NextResponse.json({ error: "trades file is required" }, { status: 400 });
    }

    const tradesBuf = Buffer.from(await tradesFile.arrayBuffer());
    const trades = parseTrades(tradesBuf);

    let actions: CorporateAction[] = [];
    if (actionsFile) {
      const actionsBuf = Buffer.from(await actionsFile.arrayBuffer());
      actions = parseCorporateActions(actionsBuf);
    }

    portfolioStore.set(portfolioId, {
      id: portfolioId,
      trades,
      actions,
      updatedAt: new Date(),
    });

    return NextResponse.json({ success: true, count: trades.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to save portfolio" }, { status: 500 });
  }
}
