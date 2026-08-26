const fs = require('fs');
const file = 'c:/Users/aryam/OneDrive/Documents/portfolio-analyzer/portfolio-analyzer/src/lib/advancedEngine.ts';
let code = fs.readFileSync(file, 'utf8');

// 1. Types
code = code.replace(/export interface Trade \{[\s\S]*?\}/, `export interface Trade {
  id?: string;
  symbol: string;
  rawSymbol: string;
  side: "Buy" | "Sell" | "Transfer In" | "Transfer Out" | "Split Adjust" | "Bonus Issue" | "Dividend Payout" | "Merger Swap";
  qty: number;
  fillPrice: number;
  commission: number;
  date: string;
  broker?: string;
  linkedActionId?: string;
}`);

if (!code.includes('export interface BuyLot')) {
  code = code.replace(/export interface PriceRecord/g, `export interface BuyLot {
  date: string;
  qty: number;
  totalCost: number;
}

export interface PriceRecord`);
}

code = code.replace(/totalDividends: number;/g, `totalDividends: number;
    totalRealizedGain: number;`);
code = code.replace(/holdings: Record<string, \{ shares: number; price: number; value: number }>;/g, `holdings: Record<string, { shares: number; price: number; value: number; cost: number; unrealizedGain: number; realizedGain: number }>;`);

const computeFn = `export function computePortfolio(
  rawTrades: Trade[],
  prices: PriceRecord[],
  rawActions: CorporateAction[]
): AnalysisResult {
  const trades = rawTrades.map(t => ({ ...t }));
  const priceMap = buildPriceMap(prices);

  const missingPriceDates: Array<{ ticker: string; date: string; interpolated: number }> = [];

  const allDates = new Set<string>();
  trades.forEach(t => allDates.add(t.date));
  prices.forEach(p => allDates.add(p.date));

  const sorted = Array.from(allDates).sort();
  if (!sorted.length) throw new Error("No data found in uploaded files.");

  const fullDates: string[] = [];
  let cur = sorted[0];
  const end = sorted[sorted.length - 1];
  const MAX_DAYS = 10000;
  let safety = 0;
  while (cur <= end && safety < MAX_DAYS) {
    fullDates.push(cur);
    cur = addDays(cur, 1);
    safety++;
  }

  const holdings: Record<string, number> = {};
  const lots: Record<string, BuyLot[]> = {};
  const realizedGains: Record<string, number> = {};
  let totalRealizedGain = 0;
  let totalDividends = 0;
  let cashBalance = 0;
  const symbolMap: Record<string, string> = {};

  const tradesByDate = new Map<string, Trade[]>();

  for (const t of trades) {
    if (!tradesByDate.has(t.date)) tradesByDate.set(t.date, []);
    tradesByDate.get(t.date)!.push(t);
    if (t.symbol !== "$CASH") symbolMap[t.rawSymbol] = t.symbol;
  }

  const dailyPortfolio: DailyPortfolioEntry[] = [];
  const seenMissing = new Set<string>();

  for (const date of fullDates) {
    for (const t of (tradesByDate.get(date) || [])) {
      const s = t.side.toLowerCase();
      const cost = t.qty * t.fillPrice + t.commission;

      if (t.symbol === "$CASH") {
        if (s === "buy" || s === "transfer in" || s === "transfer_in") cashBalance += t.qty;
        if (s === "sell" || s === "transfer out" || s === "transfer_out") cashBalance -= t.qty;
      } else {
        if (s === "buy" || s === "transfer in" || s === "transfer_in") {
          cashBalance -= cost;
          holdings[t.symbol] = (holdings[t.symbol] || 0) + t.qty;
          
          if (!lots[t.symbol]) lots[t.symbol] = [];
          lots[t.symbol].push({ date: t.date, qty: t.qty, totalCost: cost });

        } else if (s === "split adjust" || s === "bonus issue") {
          const currentShares = holdings[t.symbol] || 0;
          holdings[t.symbol] += t.qty;
          
          if (currentShares > 0 && lots[t.symbol]) {
            const ratio = (currentShares + t.qty) / currentShares;
            lots[t.symbol].forEach(lot => {
              lot.qty *= ratio;
            });
          } else {
             if (!lots[t.symbol]) lots[t.symbol] = [];
             lots[t.symbol].push({ date: t.date, qty: t.qty, totalCost: 0 });
          }

        } else if (s === "sell" || s === "transfer out" || s === "transfer_out" || s === "merger swap") {
          const proceeds = (t.qty * t.fillPrice - t.commission);
          cashBalance += proceeds;
          holdings[t.symbol] = (holdings[t.symbol] || 0) - t.qty; 
          
          let sharesToSell = t.qty;
          let costOfSold = 0;
          
          if (lots[t.symbol]) {
            while (sharesToSell > 0 && lots[t.symbol].length > 0) {
              const firstLot = lots[t.symbol][0];
              if (firstLot.qty <= sharesToSell) {
                sharesToSell -= firstLot.qty;
                costOfSold += firstLot.totalCost;
                lots[t.symbol].shift();
              } else {
                const fraction = sharesToSell / firstLot.qty;
                const costPortion = firstLot.totalCost * fraction;
                costOfSold += costPortion;
                firstLot.qty -= sharesToSell;
                firstLot.totalCost -= costPortion;
                sharesToSell = 0;
              }
            }
          }
          
          const gain = proceeds - costOfSold;
          if (!realizedGains[t.symbol]) realizedGains[t.symbol] = 0;
          realizedGains[t.symbol] += gain;
          totalRealizedGain += gain;
        } else if (s === "dividend payout") {
          cashBalance += t.fillPrice;
          totalDividends += t.fillPrice;
        }
      }
    }

    let stockValue = 0;
    const snap: DailyPortfolioEntry["holdings"] = {};

    for (const [sym, shares] of Object.entries(holdings)) {
      const realizedGain = realizedGains[sym] || 0;
      if (shares <= 0 && Math.abs(realizedGain) < 0.01) continue;

      const trade = trades.find(t => t.symbol === sym);
      const rawSym = trade?.rawSymbol;

      const price = getPriceForSymbol(sym, rawSym, date, priceMap);
      const prices = getPricesForSymbol(sym, rawSym, priceMap);
      const hasExactPrice = prices ? prices.has(date) : false;

      if (!hasExactPrice && price > 0) {
        const key = \`\${sym}|\${date}\`;
        if (!seenMissing.has(key)) {
          seenMissing.add(key);
          missingPriceDates.push({ ticker: sym, date, interpolated: price });
        }
      }
      
      const cost = (lots[sym] || []).reduce((acc, lot) => acc + lot.totalCost, 0);
      const value = shares > 0 ? shares * price : 0;
      const unrealizedGain = value - cost;
      
      stockValue += value;
      snap[sym] = {
        shares,
        price,
        value,
        cost,
        unrealizedGain,
        realizedGain
      };
    }

    dailyPortfolio.push({
      date,
      totalValue: stockValue + cashBalance,
      stockValue,
      cashBalance,
      holdings: snap
    });
  }

  const finalInvested = Object.values(lots).reduce((acc, symLots) => acc + symLots.reduce((sum, lot) => sum + lot.totalCost, 0), 0);
  const vals = dailyPortfolio.map(d => d.totalValue).filter(v => v > 0);
  const lastEntry = dailyPortfolio[dailyPortfolio.length - 1];
  const currentValue = lastEntry ? lastEntry.totalValue : 0;
  
  let holdingReturn = 0;
  if (finalInvested > 0) {
    holdingReturn = (currentValue - finalInvested) / finalInvested;
  }

  return {
    dailyPortfolio,
    corporateActions: rawActions,
    missingPriceDates,
    summary: {
      finalInvested,
      currentValue,
      holdingReturn,
      totalDividends,
      totalRealizedGain,
      uniqueStocks: Object.keys(symbolMap),
      dateRange: { start: sorted[0], end: sorted[sorted.length - 1] }
    }
  };
}`;

code = code.replace(/export function computePortfolio\([\s\S]*$/, computeFn);

fs.writeFileSync(file, code);
