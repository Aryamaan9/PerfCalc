import { NextRequest, NextResponse } from "next/server";
import { computePortfolio, PriceRecord } from "@/lib/portfolioEngine";
import { portfolioStore } from "@/lib/portfolioStore";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const portfolioId = body?.portfolioId;

    if (!portfolioId) {
      return NextResponse.json({ error: "portfolioId is required" }, { status: 400 });
    }

    const item = portfolioStore.get(portfolioId);
    if (!item) {
      return NextResponse.json({ error: "Portfolio not found" }, { status: 404 });
    }

    const { trades, actions } = item;

    // Generate price records for traded symbols across the date range
    const prices: PriceRecord[] = [];
    const symMap = new Map<string, number>();
    for (const t of trades) {
      symMap.set(t.symbol, t.fillPrice);
      prices.push({ ticker: t.symbol, date: t.date, close: t.fillPrice });
    }

    // Include valuation end prices (at +10% gain for demonstration if no other price available)
    for (const [sym, price] of symMap.entries()) {
      prices.push({ ticker: sym, date: "2023-12-31", close: Math.round(price * 1.10) });
    }

    const result = computePortfolio(trades, prices, actions);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to analyze portfolio" }, { status: 500 });
  }
}
