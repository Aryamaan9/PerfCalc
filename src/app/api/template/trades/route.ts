import { NextResponse } from "next/server";

export const dynamic = "force-static";

const CSV = `Symbol,Side,Qty,Fill Price,Commission,Closing Time
NSE:APOLLOPIPE,Buy,500,913.85,0,31-03-2021
NSE:APOLLOPIPE,Sell,500,990.65,0,07-04-2021
NSE:AUBANK,Sell,5,959.53,0,26-05-2021
NSE:AUBANK,Buy,5,962.52,0,26-05-2021
NSE:AUBANK,Buy,395,963.72,0,26-05-2021
NSE:AUBANK,Buy,125,963.95,0,26-05-2021
NSE:AUBANK,Sell,220,1209.52,0,30-07-2021
NSE:AUBANK,Sell,80,1210.20,0,30-07-2021
$CASH,Deposit,500000,0,0,01-07-2022
NSE:BAJFINANCE,Buy,150,5376.31,0,01-07-2022
NSE:BAJAJFINSV,Buy,75,10975.04,0,01-07-2022
$CASH,Deposit,500000,0,0,04-07-2022
NSE:AUBANK,Buy,900,568.01,0,04-07-2022
$CASH,Deposit,1100000,0,0,08-07-2022
NSE:IRFC,Buy,20000,20.23,0,12-07-2022
NSE:AUBANK,Buy,1100,557.93,0,14-07-2022
$CASH,Deposit,1030000,0,0,24-08-2022`;

export function GET() {
  return new NextResponse(CSV, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="trades_template.csv"',
    },
  });
}
