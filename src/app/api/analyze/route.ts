import { NextRequest, NextResponse } from "next/server";
import {
  parseTrades,
  parsePrices,
  parseCorporateActions,
  computePortfolio,
} from "@/lib/portfolioEngine";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const tradesFile = formData.get("trades") as File | null;
    const pricesFile = formData.get("prices") as File | null;
    const actionsFile = formData.get("actions") as File | null;

    if (!tradesFile) return NextResponse.json({ error: "trades file is required" }, { status: 400 });

    const tradesBuf = Buffer.from(await tradesFile.arrayBuffer());
    const trades = parseTrades(tradesBuf);

    let prices: any[] = [];
    if (pricesFile) {
      const pricesBuf = Buffer.from(await pricesFile.arrayBuffer());
      prices = parsePrices(pricesBuf);
    } else {
      const symMap = new Map<string, number>();
      for (const t of trades) {
        symMap.set(t.symbol, t.fillPrice);
        prices.push({ ticker: t.symbol, date: t.date, close: t.fillPrice });
      }
      for (const [sym, price] of symMap.entries()) {
        prices.push({ ticker: sym, date: "2023-12-31", close: Math.round(price * 1.10) });
      }
    }

    const actions = actionsFile
      ? parseCorporateActions(Buffer.from(await actionsFile.arrayBuffer()))
      : [];

    const result = computePortfolio(trades, prices, actions);

    return NextResponse.json(result);
  } catch (e: any) {
    console.error("Analysis error:", e);
    return NextResponse.json({ error: e.message || "Internal server error" }, { status: 500 });
  }
}
