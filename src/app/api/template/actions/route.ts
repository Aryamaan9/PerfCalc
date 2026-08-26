import { NextResponse } from "next/server";

export const dynamic = "force-static";

const CSV = `Date,Symbol,Action,Value
15-06-2022,AUBANK.NS,DIVIDEND,2.5
01-09-2022,BAJFINANCE.NS,SPLIT,2
05-03-2023,$CASH,DEPOSIT,100000
10-06-2023,$CASH,WITHDRAWAL,25000
20-12-2023,IRFC.NS,DIVIDEND,0.80`;

export function GET() {
  return new NextResponse(CSV, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="actions_template.csv"',
    },
  });
}
