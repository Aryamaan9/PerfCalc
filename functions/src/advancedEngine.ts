import * as XLSX from "xlsx";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface Trade {
  symbol: string;
  rawSymbol: string;
  side: "Buy" | "Sell" | "Transfer In" | "Transfer Out";
  qty: number;
  fillPrice: number;
  commission: number;
  date: string; // YYYY-MM-DD
  broker?: string;
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
  holdings: Record<string, { shares: number; price: number; value: number }>;
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
  const corporateActions = rawActions.map(a => ({ ...a }));
  const priceMap = buildPriceMap(prices);

  const retrospectivelyAppliedSplits = new Set<CorporateAction>();

  // Apply retrospective split/bonus adjustment
  const splits = corporateActions
    .filter(a => (a.action === "SPLIT" || a.action === "BONUS") && a.status !== "IGNORED" && a.status !== "PENDING")
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const split of splits) {
    const splitDate = split.date;
    const symbol = split.symbol;
    const ratio = split.value;

    if (isPriceFileSplitAdjusted(symbol, undefined, splitDate, trades, priceMap, ratio)) {
      retrospectivelyAppliedSplits.add(split);

      for (const t of trades) {
        if (t.symbol === symbol && t.date < splitDate) {
          t.qty *= ratio;
          t.fillPrice /= ratio;
        }
      }

      for (const a of corporateActions) {
        if (a.symbol === symbol && a.date < splitDate && a.action === "DIVIDEND") {
          a.value /= ratio;
        }
      }
    }
  }

  const missingPriceDates: Array<{ ticker: string; date: string; interpolated: number }> = [];

  const allDates = new Set<string>();
  trades.forEach(t => allDates.add(t.date));
  prices.forEach(p => allDates.add(p.date));
  corporateActions.forEach(a => allDates.add(a.date));

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
  const costBases: Record<string, { shares: number; cost: number }> = {};
  let totalDividends = 0;
  let cashBalance = 0; // Track cash for abnormality audit
  const symbolMap: Record<string, string> = {};

  const tradesByDate  = new Map<string, Trade[]>();
  const actionsByDate = new Map<string, CorporateAction[]>();

  for (const t of trades) {
    if (!tradesByDate.has(t.date)) tradesByDate.set(t.date, []);
    tradesByDate.get(t.date)!.push(t);
    if (t.symbol !== "$CASH") symbolMap[t.rawSymbol] = t.symbol;
  }
  for (const a of corporateActions) {
    if (!actionsByDate.has(a.date)) actionsByDate.set(a.date, []);
    actionsByDate.get(a.date)!.push(a);
  }

  const dailyPortfolio: DailyPortfolioEntry[] = [];
  const seenMissing = new Set<string>();

  for (const date of fullDates) {
    // Apply trades
    for (const t of (tradesByDate.get(date) || [])) {
      const s = t.side.toLowerCase();
      
      // Update cash balances based on trade types
      const cost = t.qty * t.fillPrice + t.commission;
      if (s === "buy") {
        cashBalance -= cost;
      } else if (s === "sell") {
        cashBalance += (t.qty * t.fillPrice - t.commission);
      }

      if (t.symbol === "$CASH") {
        if (s === "buy" || s === "transfer in" || s === "transfer_in") cashBalance += t.qty;
        if (s === "sell" || s === "transfer out" || s === "transfer_out") cashBalance -= t.qty;
      } else {
        if (s === "buy" || s === "transfer in" || s === "transfer_in") {
          holdings[t.symbol] = (holdings[t.symbol] || 0) + t.qty;
          if (!costBases[t.symbol]) costBases[t.symbol] = { shares: 0, cost: 0 };
          costBases[t.symbol].shares += t.qty;
          costBases[t.symbol].cost += cost;
        } else if (s === "sell" || s === "transfer out" || s === "transfer_out") {
          holdings[t.symbol] = (holdings[t.symbol] || 0) - t.qty; // Allow negative for audit
          if (costBases[t.symbol] && costBases[t.symbol].shares > 0) {
            const avgPrice = costBases[t.symbol].cost / costBases[t.symbol].shares;
            costBases[t.symbol].shares = Math.max(0, costBases[t.symbol].shares - t.qty);
            costBases[t.symbol].cost = costBases[t.symbol].shares * avgPrice;
          }
        }
      }
    }

    // Apply corporate actions
    for (const a of (actionsByDate.get(date) || [])) {
      if (a.status === "IGNORED" || a.status === "PENDING") continue;

      if (a.action === "SPLIT" || a.action === "BONUS") {
        if (!retrospectivelyAppliedSplits.has(a)) {
          if (holdings[a.symbol]) {
            holdings[a.symbol] *= a.value;
          }
          if (costBases[a.symbol]) {
            costBases[a.symbol].shares *= a.value;
          }
        }
      } else if (a.action === "DIVIDEND") {
        const div = (holdings[a.symbol] || 0) * a.value;
        a.totalAmount = div;
        totalDividends += div;
      } else if (a.action === "MERGER") {
        // e.g. Company A (symbol) merges into Company B (targetSymbol) at ratio `value` (e.g. 1 A -> 1.5 B)
        const currentShares = holdings[a.symbol] || 0;
        if (currentShares > 0 && a.targetSymbol) {
          const newShares = currentShares * a.value;
          const oldCost = costBases[a.symbol]?.cost || 0;
          
          holdings[a.symbol] = 0;
          if (costBases[a.symbol]) {
            costBases[a.symbol].shares = 0;
            costBases[a.symbol].cost = 0;
          }
          
          holdings[a.targetSymbol] = (holdings[a.targetSymbol] || 0) + newShares;
          if (!costBases[a.targetSymbol]) costBases[a.targetSymbol] = { shares: 0, cost: 0 };
          costBases[a.targetSymbol].shares += newShares;
          costBases[a.targetSymbol].cost += oldCost;
        }
      } else if (a.action === "DEMERGER") {
        // e.g. Company A (symbol) spins off Company B (targetSymbol). `value` = ratio (e.g. 1 B for every 1 A).
        const currentShares = holdings[a.symbol] || 0;
        if (currentShares > 0 && a.targetSymbol) {
          const newShares = currentShares * a.value;
          holdings[a.targetSymbol] = (holdings[a.targetSymbol] || 0) + newShares;
          
          // Cost basis allocation for demergers is complex, typically a percentage split. 
          // For simplicity in MVP, we assign 0 cost basis to the spun-off entity unless specified.
          if (!costBases[a.targetSymbol]) costBases[a.targetSymbol] = { shares: 0, cost: 0 };
          costBases[a.targetSymbol].shares += newShares;
        }
      } else if (a.action === "RIGHTS") {
        // Rights issues mathematically adjust cost basis or holdings if subscribed. 
        // For MVP, rights issues serve as audit trails rather than auto-adjusting shares 
        // since user must choose to exercise them.
      }
    }

    // Compute stock value
    let stockValue = 0;
    const snap: DailyPortfolioEntry["holdings"] = {};

    for (const [sym, shares] of Object.entries(holdings)) {
      if (shares <= 0) continue;
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
      const value = shares * price;
      stockValue += value;
      snap[sym] = { shares, price, value };
    }

    dailyPortfolio.push({
      date,
      totalValue: stockValue + cashBalance,
      stockValue,
      cashBalance,
      holdings: snap,
    });
  }

  // Cost basis of active holdings at the end
  const finalInvested = Object.values(costBases).reduce((acc, item) => acc + item.cost, 0);

  const vals = dailyPortfolio.map(d => d.totalValue).filter(v => v > 0);
  const lastEntry = dailyPortfolio[dailyPortfolio.length - 1];
  const currentValue = lastEntry?.totalValue || 0;
  const peakValue = Math.max(...vals, 0);
  const holdingReturn = finalInvested > 0 ? ((currentValue - finalInvested) / finalInvested) * 100 : 0;

  // ─── Anomaly Detection / Reconciliation & Audit ───
  const reconciliationWarnings = new Set<string>();
  const auditAlerts = new Set<string>();

  if (dailyPortfolio.length > 0) {
    const firstDay = dailyPortfolio[0];
    if (firstDay.cashBalance < -0.01) {
      auditAlerts.add(`Negative Cash Balance: Cash fell to ${firstDay.cashBalance.toFixed(2)} on ${firstDay.date}`);
    }
    for (const [sym, holding] of Object.entries(firstDay.holdings)) {
      if (holding.shares < 0) {
        auditAlerts.add(`Negative Holdings: ${sym.replace(".NS", "")} shares fell below zero (${holding.shares}) on ${firstDay.date}`);
      }
    }
  }

  for (let i = 1; i < dailyPortfolio.length; i++) {
    const prevDay = dailyPortfolio[i - 1];
    const currDay = dailyPortfolio[i];

    if (currDay.cashBalance < -0.01 && prevDay.cashBalance >= -0.01) {
      auditAlerts.add(`Negative Cash Balance: Cash fell to ${currDay.cashBalance.toFixed(2)} on ${currDay.date}`);
    }

    for (const [sym, currHolding] of Object.entries(currDay.holdings)) {
      if (currHolding.shares < 0 && (!prevDay.holdings[sym] || prevDay.holdings[sym].shares >= 0)) {
        auditAlerts.add(`Negative Holdings: ${sym.replace(".NS", "")} shares fell below zero (${currHolding.shares}) on ${currDay.date}`);
      }

      const prevHolding = prevDay.holdings[sym];
      if (prevHolding && prevHolding.value > 0 && currHolding.value > 0) {
        let tradeNetValue = 0;
        const dayTrades = tradesByDate.get(currDay.date) || [];
        for (const t of dayTrades) {
          if (t.symbol === sym) {
            tradeNetValue += (t.side.toLowerCase().includes("buy") || t.side.toLowerCase().includes("in") ? 1 : -1) * t.qty * t.fillPrice;
          }
        }

        const expectedValue = prevHolding.value + tradeNetValue;
        if (expectedValue > 0) {
          const ratio = currHolding.value / expectedValue;
          
          if (ratio > 1.5 || ratio < 0.5) {
            auditAlerts.add(`Extreme Volatility: ${sym.replace(".NS", "")} changed by ${Math.abs((ratio - 1) * 100).toFixed(0)}% on ${currDay.date}`);
          }

          if (ratio > 1.25 || ratio < 0.75) {
            const hasRecentAction = corporateActions.some(
              a => a.symbol === sym && Math.abs(daysBetween(a.date, currDay.date)) <= 5
            );

            if (hasRecentAction) {
              const direction = ratio > 1 ? "surged" : "dropped";
              const percent = Math.abs((ratio - 1) * 100).toFixed(0);
              reconciliationWarnings.add(
                `Reconciliation Alert: ${sym.replace(".NS", "")} holding value ${direction} by ${percent}% on ${currDay.date}. Verify that Corporate Action ratios and price adjustments are correct.`
              );
            }
          }
        }
      }
    }
  }

  return {
    dailyPortfolio,
    corporateActions,
    missingPriceDates: missingPriceDates.slice(0, 200),
    summary: {
      totalInvested: finalInvested,
      peakValue,
      currentValue,
      holdingReturn,
      totalDividends,
      uniqueStocks: Object.keys(holdings).filter(s => s !== "$CASH"),
      dateRange: { start: sorted[0], end: sorted[sorted.length - 1] },
    },
    tradeLog: trades,
    symbolMap,
    reconciliationWarnings: Array.from(reconciliationWarnings),
    auditAlerts: Array.from(auditAlerts),
  };
}
