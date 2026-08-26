import { NextResponse } from "next/server";
import { portfolioStore } from "@/lib/portfolioStore";

export const dynamic = "force-static";

export async function GET() {
  try {
    const portfolios = Array.from(portfolioStore.keys());
    return NextResponse.json({ portfolios });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to list portfolios" }, { status: 500 });
  }
}
