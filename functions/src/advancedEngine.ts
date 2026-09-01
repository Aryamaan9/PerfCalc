import * as XLSX from "xlsx";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Trade {
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
}

export interface BuyLot {
  date: string;
  qty: number;
  totalCost: number;
}

export interface PriceRecord {
  ticker: string;
  date: string; // YYYY-MM-DD
  close: number;
}

export interface CorporateAction {
  id?: string;
  date: string; // YYYY-MM-DD
  symbol: string;
  action: "DIVIDEND" | "SPLIT" | "BONUS" | "MERGER" | "DEMERGER" | "RIGHTS" | "DEPOSIT" | "WITHDRAWAL";
  value: number;
  totalAmount?: number; // Total cash amount for dividend
  ratio?: string; // e.g. "1:1"
  targetSymbol?: string; // For mergers/demergers
  status?: "PENDING" | "APPLIED" | "IGNORED";
}

export interface DailyPortfolioEntry {
  date: string; // YYYY-MM-DD
  totalValue: number;
  stockValue: number;
  cashBalance: number;
  holdings: Record<string, { shares: number; price: number; value: number; cost: number; unrealizedGain: number; realizedGain: number }>;
}

export interface AnalysisResult {
  dailyPortfolio: DailyPortfolioEntry[];
  corporateActions: CorporateAction[];
  missingPriceDates: Array<{ ticker: string; date: string; interpolated: number }>;
  summary: {
    totalInvested: number;
    peakValue: number;
    currentValue: number;
    holdingReturn: number;
    totalDividends: number;
    totalRealizedGain: number;
    uniqueStocks: string[];
    dateRange: { start: string; end: string };
  };
  tradeLog: Trade[];
  symbolMap: Record<string, string>;
  reconciliationWarnings: string[];
  auditAlerts: string[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
  january: "01", february: "02", march: "03", april: "04", june: "06",
  july: "07", august: "08", september: "09", october: "10", november: "11", december: "12",
};

export function formatDateLocal(dt: Date): string {
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function sanitizeYmd(ymd: string): string {
  if (!ymd) return ymd;
  const parts = ymd.split("-");
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    if (!isNaN(y) && !isNaN(m) && !isNaN(d)) {
      if (m > 12 && d <= 12) {
        return `${parts[0]}-${parts[2].padStart(2, "0")}-${parts[1].padStart(2, "0")}`;
      }
    }
  }
  return ymd;
}

export function parseDate(raw: string | number | Date | undefined): string {
  const result = parseDateRaw(raw);
  return sanitizeYmd(result);
}

function parseDateRaw(raw: string | number | Date | undefined): string {
  if (!raw && raw !== 0) return "";

  if (raw instanceof Date) {
    return formatDateLocal(raw);
  }

  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }

  const s = String(raw).trim();
  if (!s) return "";

  const datePart = s.split(/[\sT]/)[0].trim();
  if (!datePart) return "";

  // 1) YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const mIso = datePart.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (mIso) {
    return `${mIso[1]}-${mIso[2].padStart(2, "0")}-${mIso[3].padStart(2, "0")}`;
  }

  // 2) DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const mDmy4 = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (mDmy4) {
    return `${mDmy4[3]}-${mDmy4[2].padStart(2, "0")}-${mDmy4[1].padStart(2, "0")}`;
  }

  // 3) DD/MM/YY or DD-MM-YY or DD.MM.YY
  const mDmy2 = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (mDmy2) {
    const yy = parseInt(mDmy2[3], 10);
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mDmy2[2].padStart(2, "0")}-${mDmy2[1].padStart(2, "0")}`;
  }

  // 4) 8 digits without separator
  if (/^\d{8}$/.test(datePart)) {
    const first4 = parseInt(datePart.slice(0, 4), 10);
    const last4 = parseInt(datePart.slice(4, 8), 10);
    if (first4 >= 1900 && first4 <= 2100) {
      return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
    } else if (last4 >= 1900 && last4 <= 2100) {
      return `${datePart.slice(4, 8)}-${datePart.slice(2, 4)}-${datePart.slice(0, 2)}`;
    }
  }

  // 4b) 5 digits Excel serial date string
  if (/^\d{5}$/.test(datePart)) {
    const num = parseInt(datePart, 10);
    const d = XLSX.SSF.parse_date_code(num);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }

  // 5) 6 digits without separator
  if (/^\d{6}$/.test(datePart)) {
    const dd = datePart.slice(0, 2);
    const mm = datePart.slice(2, 4);
    const yy = parseInt(datePart.slice(4, 6), 10);
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }

  // 6) DD-Mon-YYYY
  const m3 = s.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3,9})[\/\-\s,]*(\d{2,4})/);
  if (m3) {
    const mon = MONTH_MAP[m3[2].toLowerCase().slice(0, 3)];
    if (mon) {
      const yr = m3[3].length === 2 ? `20${m3[3]}` : m3[3];
      return `${yr}-${mon}-${m3[1].padStart(2, "0")}`;
    }
  }

  // 7) Mon DD, YYYY
  const m4 = s.match(/^([A-Za-z]{3,9})[\/\-\s,]*(\d{1,2})[\/\-\s,]*(\d{4})/);
  if (m4) {
    const mon = MONTH_MAP[m4[1].toLowerCase().slice(0, 3)];
    if (mon) return `${m4[3]}-${mon}-${m4[2].padStart(2, "0")}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return formatDateLocal(parsed);
  }

  return "";
}

export function parseNumber(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  const clean = String(val).replace(/[^\d\.\-]/g, "");
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

export function normalizeSymbol(raw: string): string {
  if (!raw) return "";
  raw = raw.trim();
  if (raw === "$CASH") return "$CASH";
  const m = raw.match(/^(?:NSE|BSE):(.+)$/i);
  if (m) return `${m[1].toUpperCase()}.NS`;
  if (/\.(NS|BO)$/i.test(raw)) return raw.toUpperCase();
  return `${raw.toUpperCase()}.NS`;
}

// Timezone-immune UTC date math
export function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  const utca = Date.UTC(ya, ma - 1, da);
  const utcb = Date.UTC(yb, mb - 1, db);
  return Math.round((utcb - utca) / 86400000);
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

export function parseTrades(buf: any): Trade[] {
  const isBrowser = typeof window !== "undefined" && buf instanceof ArrayBuffer;
  const wb = XLSX.read(buf, { type: isBrowser ? "array" : "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  return rows.map(r => {
    const sym = String(r["Symbol"] || r["symbol"] || "").trim();
    if (!sym) return null;
    const d = parseDate(r["Closing Time"] || r["Date"] || r["date"] || r["ClosingTime"] || "");
    if (!d) return null;

    const sideRaw = String(r["Side"] || r["side"] || r["Type"] || "").trim().toLowerCase();
    let side: Trade["side"] = "Buy";
    if (sideRaw === "sell") side = "Sell";
    else if (sideRaw === "transfer in" || sideRaw === "transfer_in") side = "Transfer In";
    else if (sideRaw === "transfer out" || sideRaw === "transfer_out") side = "Transfer Out";
    else if (sideRaw !== "buy") return null;

    const qty = parseNumber(r["Qty"] || r["qty"] || r["Quantity"]);
    const fillPrice = parseNumber(r["Fill Price"] || r["FillPrice"] || r["Price"]);
    const commission = Math.max(0, parseNumber(r["Commission"]));
    const broker = String(r["Broker"] || r["broker"] || "").trim() || undefined;

    if (qty <= 0 || fillPrice < 0) return null;

    return {
      rawSymbol: sym,
      symbol: normalizeSymbol(sym),
      side,
      qty,
      fillPrice,
      commission,
      date: d,
      broker
    } as Trade;
  }).filter(Boolean).sort((a: any, b: any) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    // Transfers process before buys/sells just as a convention
    if (a.side.includes("Transfer") && !b.side.includes("Transfer")) return -1;
    if (!a.side.includes("Transfer") && b.side.includes("Transfer")) return 1;
    if (a.side === "Buy" && b.side === "Sell") return -1;
    if (a.side === "Sell" && b.side === "Buy") return 1;
    return 0;
  }) as Trade[];
}

export function parsePrices(buf: any): PriceRecord[] {
  const isBrowser = typeof window !== "undefined" && buf instanceof ArrayBuffer;
  const wb = XLSX.read(buf, { type: isBrowser ? "array" : "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  return rows.map(r => {
    const ticker = String(r["Ticker"] || r["ticker"] || r["Symbol"] || "").trim();
    if (!ticker) return null;
    const d = parseDate(r["Date"] || r["date"] || "");
    if (!d) return null;
    const vals = Object.values(r);
    const close = parseNumber(r["Close"] || r["close"] || r["Price"] || r["ClosePrice"] || vals[2]);
    if (close <= 0) return null;
    return { ticker: ticker.toUpperCase(), date: d, close } as PriceRecord;
  }).filter(Boolean) as PriceRecord[];
}

export function parseCorporateActions(buf: any): CorporateAction[] {
  const isBrowser = typeof window !== "undefined" && buf instanceof ArrayBuffer;
  const wb = XLSX.read(buf, { type: isBrowser ? "array" : "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: Record<string, any>[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const valid = ["DIVIDEND", "SPLIT", "BONUS", "MERGER", "DEMERGER", "RIGHTS", "DEPOSIT", "WITHDRAWAL"];
  return rows.map(r => {
    const d = parseDate(r["Date"] || r["date"] || "");
    const sym = normalizeSymbol(String(r["Symbol"] || r["symbol"] || ""));
    const action = String(r["Action"] || r["action"] || r["Type"] || "").toUpperCase().trim() as CorporateAction["action"];
    const value = parseNumber(r["Value"] || r["value"] || r["Amount"]);
    const ratio = String(r["Ratio"] || r["ratio"] || "").trim() || undefined;
    const targetSymbol = normalizeSymbol(String(r["Target Symbol"] || r["targetSymbol"] || ""));
    if (!d || !valid.includes(action) || value <= 0) return null;
    return { date: d, symbol: sym, action, value, ratio, targetSymbol: targetSymbol || undefined, status: "APPLIED" } as CorporateAction;
  }).filter(Boolean).sort((a: any, b: any) => a.date.localeCompare(b.date)) as CorporateAction[];
}

// ─── Price Map & Interpolation ────────────────────────────────────────────────

export function buildPriceMap(records: PriceRecord[]) {
  const map = new Map<string, Map<string, number>>();
  for (const r of records) {
    if (!map.has(r.ticker)) map.set(r.ticker, new Map());
    map.get(r.ticker)!.set(r.date, r.close);
  }
  return map;
}

export function getPricesForSymbol(
  sym: string,
  rawSym: string | undefined,
  priceMap: Map<string, Map<string, number>>
): Map<string, number> | undefined {
  const candidates: string[] = [];
  if (sym) {
    candidates.push(sym.toUpperCase());
    const base = sym.replace(/\.(NS|BO)$/i, "").toUpperCase();
    if (base && base !== sym.toUpperCase()) candidates.push(base);
    if (!candidates.includes(`${base}.NS`)) candidates.push(`${base}.NS`);
    if (!candidates.includes(`${base}.BO`)) candidates.push(`${base}.BO`);
  }
  if (rawSym) {
    candidates.push(rawSym.toUpperCase());
    const baseRaw = rawSym.replace(/^(NSE|BSE):/i, "").replace(/\.(NS|BO)$/i, "").toUpperCase();
    if (baseRaw && !candidates.includes(baseRaw)) candidates.push(baseRaw);
    if (!candidates.includes(`${baseRaw}.NS`)) candidates.push(`${baseRaw}.NS`);
    if (!candidates.includes(`${baseRaw}.BO`)) candidates.push(`${baseRaw}.BO`);
  }

  for (const cand of candidates) {
    if (priceMap.has(cand)) {
      return priceMap.get(cand);
    }
  }
  return undefined;
}

export function getPriceForSymbol(
  sym: string,
  rawSym: string | undefined,
  date: string,
  priceMap: Map<string, Map<string, number>>
): number {
  const prices = getPricesForSymbol(sym, rawSym, priceMap);
  if (!prices) return 0;
  if (prices.has(date)) return prices.get(date)!;
  return interpolatePrice(sym, rawSym, date, priceMap);
}

export function interpolatePrice(
  sym: string,
  rawSym: string | undefined,
  date: string,
  priceMap: Map<string, Map<string, number>>
): number {
  const prices = getPricesForSymbol(sym, rawSym, priceMap);
  if (!prices) return 0;
  const all = Array.from(prices.keys()).sort();
  const before = all.filter(d => d < date);
  const after  = all.filter(d => d > date);
  if (before.length && after.length) {
    const bD = before[before.length - 1], aD = after[0];
    const bP = prices.get(bD)!, aP = prices.get(aD)!;
    const bd = daysBetween(bD, date), ad = daysBetween(date, aD);
    return (bP * ad + aP * bd) / (bd + ad);
  }
  if (before.length) return prices.get(before[before.length - 1])!;
  if (after.length)  return prices.get(after[0])!;
  return 0;
}

export function isPriceFileSplitAdjusted(
  symbol: string,
  rawSymbol: string | undefined,
  splitDate: string,
  trades: Trade[],
  priceMap: Map<string, Map<string, number>>,
  ratio: number
): boolean {
  const priorTrade = trades.find(t => t.symbol === symbol && t.date < splitDate && t.side.toLowerCase() === "buy");
  if (!priorTrade) return false;

  const prices = getPricesForSymbol(symbol, rawSymbol || priorTrade.rawSymbol, priceMap);
  if (!prices) return false;

  const closePrice = prices.get(priorTrade.date) || interpolatePrice(symbol, rawSymbol || priorTrade.rawSymbol, priorTrade.date, priceMap);
  if (closePrice <= 0) return false;

  const ratioInFile = priorTrade.fillPrice / closePrice;
  return Math.abs(ratioInFile - ratio) < Math.abs(ratioInFile - 1);
}

// ─── Main Computation ────────────────────────────────────────────────────────

export function computePortfolio(
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
        const key = `${sym}|${date}`;
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
    tradeLog: trades,
    symbolMap,
    reconciliationWarnings: [],
    auditAlerts: [],
    summary: {
      totalInvested: finalInvested,
      peakValue: Math.max(0, ...vals),
      currentValue,
      holdingReturn,
      totalDividends,
      totalRealizedGain,
      uniqueStocks: Object.keys(symbolMap),
      dateRange: { start: sorted[0], end: sorted[sorted.length - 1] }
    }
  };
}
export interface HoldingStatementEntry {
  rawSymbol: string;
  symbol: string;
  qty: number;
  avgCost: number;
  value?: number;
}

export function parseHoldingStatement(buf: any): { date: string, holdings: HoldingStatementEntry[] } {
  const isBrowser = typeof window !== 'undefined' && buf instanceof ArrayBuffer;
  const wb = XLSX.read(buf, { type: isBrowser ? 'array' : 'buffer', cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '', raw: false }) as Record<string, any>[];
  
  const holdings: HoldingStatementEntry[] = [];
  let detectedDate = '';

  for (const r of rows) {
    const rowString = JSON.stringify(r);
    const dateMatch = rowString.match(/As Of Date:?\s*([0-9]{4}-[0-9]{2}-[0-9]{2})/i);
    if (dateMatch && !detectedDate) detectedDate = dateMatch[1];

    let sym = '';
    let qtyRaw: any = '';
    let costRaw: any = '';

    for (const [key, val] of Object.entries(r)) {
      const k = key.toLowerCase().replace(/[^a-z]/g, '');
      if (k === 'symbol' || k === 'ticker' || k === 'instrument' || k === 'stock' || k === 'scrip' || k === 'symbolname') {
         if (!sym) sym = String(val).trim();
      }
      if (k === 'qty' || k === 'quantity' || k === 'totalqty' || k === 'balance' || k === 'availableqty' || k === 'holdingqty' || k === 'shares') {
         if (qtyRaw === '') qtyRaw = val;
      }
      if (k === 'averagecost' || k === 'cost' || k === 'buyprice' || k === 'averageprice' || k === 'avgcost' || k === 'buyaverage' || k === 'price') {
         if (costRaw === '') costRaw = val;
      }
      if (!detectedDate && (k === 'date' || k === 'asofdate')) {
         const dateVal = parseDate(String(val));
         if (dateVal) detectedDate = dateVal;
      }
    }

    if (!sym) continue;

    const qty = parseNumber(qtyRaw);
    const avgCost = parseNumber(costRaw);
    
    if (qty > 0 || qty < 0) {
      holdings.push({
        rawSymbol: sym,
        symbol: normalizeSymbol(sym),
        qty,
        avgCost
      });
    }
  }

  if (!detectedDate) detectedDate = new Date().toISOString().split('T')[0];
  return { date: detectedDate, holdings };
}
