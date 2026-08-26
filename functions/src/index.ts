import * as functions from "firebase-functions";
import { getFirestore } from "firebase-admin/firestore";
import * as admin from "firebase-admin";
import * as XLSX from "xlsx";
import Busboy from "busboy";
import cors from "cors";
import { fetchHistoricalPrices } from "./services/yahooFinanceFetcher";


admin.initializeApp({ projectId: "portfolio-alyzr-83921" });

const corsHandler = cors({ origin: true });

// ─── Types ────────────────────────────────────────────────────────────────────

interface Trade {
  symbol: string;         // normalized: AUBANK.NS
  rawSymbol: string;      // original: NSE:AUBANK
  side: "Buy" | "Sell" | "Deposit" | "Withdrawal";
  qty: number;
  fillPrice: number;
  commission: number;
  date: string;           // YYYY-MM-DD
}

interface PriceRecord {
  ticker: string;         // SYMBOL.NS
  date: string;           // YYYY-MM-DD
  close: number;
}

interface CorporateAction {
  date: string;
  symbol: string;
  action: "DIVIDEND" | "SPLIT" | "DEPOSIT" | "WITHDRAWAL";
  value: number;
  totalAmount?: number;
}

interface DailyPortfolioEntry {
  date: string;
  totalValue: number;
  stockValue: number;
  holdings: Record<string, { shares: number; price: number; value: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MONTH_MAP: Record<string, string> = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  january:"01",february:"02",march:"03",april:"04",june:"06",
  july:"07",august:"08",september:"09",october:"10",november:"11",december:"12",
};

function formatDateLocal(dt: Date): string {
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sanitizeYmd(ymd: string): string {
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

function parseDate(raw: string | number | Date | undefined): string {
  const result = parseDateRaw(raw);
  return sanitizeYmd(result);
}

function parseDateRaw(raw: string | number | Date | undefined): string {
  if (!raw && raw !== 0) return "";

  // Handle JS Date objects
  if (raw instanceof Date) {
    return formatDateLocal(raw);
  }

  // Handle Excel serial date numbers
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }

  // Everything else: coerce to string and try patterns
  const s = String(raw).trim();
  if (!s) return "";

  // Split to get only the date portion (ignore time part)
  const datePart = s.split(/[\sT]/)[0].trim();
  if (!datePart) return "";

  // 1) YYYY/MM/DD or YYYY-MM-DD or YYYY.MM.DD
  const mIso = datePart.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (mIso) {
    return `${mIso[1]}-${mIso[2].padStart(2,"0")}-${mIso[3].padStart(2,"0")}`;
  }

  // 2) DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const mDmy4 = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (mDmy4) {
    return `${mDmy4[3]}-${mDmy4[2].padStart(2,"0")}-${mDmy4[1].padStart(2,"0")}`;
  }

  // 3) DD/MM/YY or DD-MM-YY or DD.MM.YY
  const mDmy2 = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (mDmy2) {
    const yy = parseInt(mDmy2[3]);
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mDmy2[2].padStart(2,"0")}-${mDmy2[1].padStart(2,"0")}`;
  }

  // 4) 8 digits without separator (e.g. "26052021" or "20210526")
  if (/^\d{8}$/.test(datePart)) {
    const first4 = parseInt(datePart.slice(0, 4));
    const last4 = parseInt(datePart.slice(4, 8));
    if (first4 >= 1900 && first4 <= 2100) {
      return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
    } else if (last4 >= 1900 && last4 <= 2100) {
      return `${datePart.slice(4, 8)}-${datePart.slice(2, 4)}-${datePart.slice(0, 2)}`;
    }
  }

  // 4b) 5 digits Excel serial date string (e.g. "44342")
  if (/^\d{5}$/.test(datePart)) {
    const num = parseInt(datePart);
    const d = XLSX.SSF.parse_date_code(num);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
    }
  }

  // 5) 6 digits without separator (e.g. "260521")
  if (/^\d{6}$/.test(datePart)) {
    const dd = datePart.slice(0, 2);
    const mm = datePart.slice(2, 4);
    const yy = parseInt(datePart.slice(4, 6));
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  }

  // 6) DD-Mon-YYYY  /  DD Mon YYYY  /  DD/Mon/YYYY  (e.g. "01-Jun-2021")
  const m3 = s.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3,9})[\/\-\s,]*(\d{2,4})/);
  if (m3) {
    const mon = MONTH_MAP[m3[2].toLowerCase().slice(0, 3)];
    if (mon) {
      const yr = m3[3].length === 2 ? `20${m3[3]}` : m3[3];
      return `${yr}-${mon}-${m3[1].padStart(2,"0")}`;
    }
  }

  // 7) Mon DD, YYYY  (e.g. "Jun 01, 2021")
  const m4 = s.match(/^([A-Za-z]{3,9})[\/\-\s,]*(\d{1,2})[\/\-\s,]*(\d{4})/);
  if (m4) {
    const mon = MONTH_MAP[m4[1].toLowerCase().slice(0, 3)];
    if (mon) return `${m4[3]}-${mon}-${m4[2].padStart(2,"0")}`;
  }

  // 8) Fallback: let JS Date constructor try to parse it
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return formatDateLocal(parsed);
  }

  console.warn(`[parseDate] Unable to parse date: "${s}"`);
  return "";
}

function parseNumber(val: any): number {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  const clean = String(val).replace(/[^\d\.\-]/g, "");
  return parseFloat(clean) || 0;
}

function normalizeSymbol(raw: string): string {
  if (!raw) return "";
  raw = raw.trim();
  if (raw === "$CASH") return "$CASH";
  // NSE:SYMBOL → SYMBOL.NS
  const m = raw.match(/^(?:NSE|BSE):(.+)$/i);
  if (m) return `${m[1].toUpperCase()}.NS`;
  // Already SYMBOL.NS
  if (raw.endsWith(".NS") || raw.endsWith(".BO")) return raw.toUpperCase();
  return `${raw.toUpperCase()}.NS`;
}

function addDays(dateStr: string, n: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split("-").map(Number);
  const [yb, mb, db] = b.split("-").map(Number);
  const utca = Date.UTC(ya, ma - 1, da);
  const utcb = Date.UTC(yb, mb - 1, db);
  return Math.round((utcb - utca) / 86400000);
}

// ─── Parsers ─────────────────────────────────────────────────────────────────

function parseTrades(buffer: Buffer): Trade[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const trades: Trade[] = [];

  for (const row of rows) {
    const symbol = String(row["Symbol"] || row["symbol"] || "").trim();
    if (!symbol) continue;
    const rawDate = row["Closing Time"] || row["Date"] || row["date"] || "";
    const date = parseDate(rawDate);
    if (!date) continue;

    const sideRaw = String(row["Side"] || row["side"] || row["Type"] || "").trim().toLowerCase();
    if (sideRaw !== "buy" && sideRaw !== "sell") continue;

    const qty = parseNumber(row["Qty"] || row["qty"] || row["Quantity"]);
    const fillPrice = parseNumber(row["Fill Price"] || row["FillPrice"] || row["Price"]);
    const commission = Math.max(0, parseNumber(row["Commission"]));

    if (qty <= 0 || fillPrice < 0) continue;

    trades.push({
      rawSymbol: symbol,
      symbol: normalizeSymbol(symbol),
      side: sideRaw === "buy" ? "Buy" : "Sell",
      qty,
      fillPrice,
      commission,
      date,
    });
  }

  return trades.sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    if (a.side === "Buy" && b.side === "Sell") return -1;
    if (a.side === "Sell" && b.side === "Buy") return 1;
    return 0;
  });
}

function parsePrices(buffer: Buffer): PriceRecord[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const records: PriceRecord[] = [];

  for (const row of rows) {
    const ticker = String(row["Ticker"] || row["ticker"] || row["Symbol"] || "").trim();
    if (!ticker) continue;
    const rawDate = row["Date"] || row["date"] || "";
    const date = parseDate(rawDate);
    if (!date) continue;
    const close = parseNumber(row["Close"] || row["close"] || row["Price"] || row["ClosePrice"] || Object.values(row)[2]);
    if (close > 0) {
      records.push({ ticker: ticker.toUpperCase(), date, close });
    }
  }

  return records;
}

function parseCorporateActions(buffer: Buffer): CorporateAction[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const actions: CorporateAction[] = [];

  for (const row of rows) {
    const rawDate = row["Date"] || row["date"] || "";
    const date = parseDate(rawDate);
    if (!date) continue;
    const symbol = normalizeSymbol(String(row["Symbol"] || row["symbol"] || ""));
    const action = String(row["Action"] || row["action"] || row["Type"] || "").toUpperCase().trim() as CorporateAction["action"];
    const value = parseNumber(row["Value"] || row["value"] || row["Amount"]);
    if (["DIVIDEND","SPLIT","DEPOSIT","WITHDRAWAL"].includes(action) && value > 0) {
      actions.push({ date, symbol, action, value });
    }
  }

  return actions.sort((a, b) => a.date.localeCompare(b.date));
}

// ─── Price Interpolation ──────────────────────────────────────────────────────

function buildPriceMap(records: PriceRecord[]): Map<string, Map<string, number>> {
  // ticker → (date → price)
  const map = new Map<string, Map<string, number>>();
  for (const r of records) {
    if (!map.has(r.ticker)) map.set(r.ticker, new Map());
    map.get(r.ticker)!.set(r.date, r.close);
  }
  return map;
}

function getPricesForSymbol(
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

function getPriceForSymbol(
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

function interpolatePrice(
  sym: string,
  rawSym: string | undefined,
  date: string,
  priceMap: Map<string, Map<string, number>>
): number {
  const prices = getPricesForSymbol(sym, rawSym, priceMap);
  if (!prices) return 0;
  const allDates = Array.from(prices.keys()).sort();
  const before = allDates.filter(d => d < date);
  const after = allDates.filter(d => d > date);

  if (before.length && after.length) {
    const bDate = before[before.length - 1];
    const aDate = after[0];
    const bPrice = prices.get(bDate)!;
    const aPrice = prices.get(aDate)!;
    const bDays = daysBetween(bDate, date);
    const aDays = daysBetween(date, aDate);
    const total = bDays + aDays;
    return (bPrice * aDays + aPrice * bDays) / total;
  }
  if (before.length) return prices.get(before[before.length - 1])!;
  if (after.length) return prices.get(after[0])!;
  return 0;
}

function isPriceFileSplitAdjusted(
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

// ─── Core Computation ────────────────────────────────────────────────────────

interface AnalysisResult {
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
}

function computePortfolio(
  rawTrades: Trade[],
  prices: PriceRecord[],
  rawActions: CorporateAction[]
): AnalysisResult {
  // Deep copy to prevent side-effects on original arrays
  const trades = rawTrades.map(t => ({ ...t }));
  const corporateActions = rawActions.map(a => ({ ...a }));
  const priceMap = buildPriceMap(prices);

  const retrospectivelyAppliedSplits = new Set<CorporateAction>();

  // Apply retrospective split adjustment
  const splits = corporateActions
    .filter(a => a.action === "SPLIT")
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
  const missingPriceDates: AnalysisResult["missingPriceDates"] = [];

  // Build set of all relevant dates
  const allDates = new Set<string>();
  trades.forEach(t => allDates.add(t.date));
  prices.forEach(p => allDates.add(p.date));
  corporateActions.forEach(a => allDates.add(a.date));

  const sortedDates = Array.from(allDates).sort();
  if (!sortedDates.length) throw new Error("No dates found in data");

  // Fill in every calendar day between min and max date
  const startDate = sortedDates[0];
  const endDate = sortedDates[sortedDates.length - 1];
  const fullDates: string[] = [];
  let cur = startDate;
  while (cur <= endDate) {
    fullDates.push(cur);
    cur = addDays(cur, 1);
  }

  // State
  const holdings: Record<string, number> = {}; // symbol → shares
  const costBases: Record<string, { shares: number; cost: number }> = {}; // symbol -> cost basis
  let totalDividends = 0;
  const symbolMap: Record<string, string> = {};

  // Group trades and actions by date
  const tradesByDate = new Map<string, Trade[]>();
  for (const t of trades) {
    if (!tradesByDate.has(t.date)) tradesByDate.set(t.date, []);
    tradesByDate.get(t.date)!.push(t);
    if (t.symbol !== "$CASH") symbolMap[t.rawSymbol] = t.symbol;
  }

  const actionsByDate = new Map<string, CorporateAction[]>();
  for (const a of corporateActions) {
    if (!actionsByDate.has(a.date)) actionsByDate.set(a.date, []);
    actionsByDate.get(a.date)!.push(a);
  }

  const dailyPortfolio: DailyPortfolioEntry[] = [];
  const seenMissing = new Set<string>();

  for (const date of fullDates) {
    // Apply trades
    const dayTrades = tradesByDate.get(date) || [];
    for (const t of dayTrades) {
      if (t.symbol !== "$CASH") {
        const side = t.side.toLowerCase();
        if (side === "buy") {
          holdings[t.symbol] = (holdings[t.symbol] || 0) + t.qty;
          const cost = t.qty * t.fillPrice + t.commission;

          if (!costBases[t.symbol]) costBases[t.symbol] = { shares: 0, cost: 0 };
          costBases[t.symbol].shares += t.qty;
          costBases[t.symbol].cost += cost;
        } else if (side === "sell") {
          holdings[t.symbol] = Math.max(0, (holdings[t.symbol] || 0) - t.qty);

          if (costBases[t.symbol] && costBases[t.symbol].shares > 0) {
            const avgPrice = costBases[t.symbol].cost / costBases[t.symbol].shares;
            costBases[t.symbol].shares = Math.max(0, costBases[t.symbol].shares - t.qty);
            costBases[t.symbol].cost = costBases[t.symbol].shares * avgPrice;
          }
        }
      }
    }

    // Apply corporate actions
    const dayActions = actionsByDate.get(date) || [];
    for (const a of dayActions) {
      if (a.action === "SPLIT") {
        if (!retrospectivelyAppliedSplits.has(a)) {
          if (holdings[a.symbol]) {
            holdings[a.symbol] = holdings[a.symbol] * a.value;
          }
          if (costBases[a.symbol]) {
            costBases[a.symbol].shares *= a.value;
          }
        }
      } else if (a.action === "DIVIDEND") {
        const shares = holdings[a.symbol] || 0;
        const dividendAmount = shares * a.value;
        a.totalAmount = dividendAmount;
        totalDividends += dividendAmount;
      }
    }

    // Compute stock value
    let stockValue = 0;
    const holdingsSnapshot: DailyPortfolioEntry["holdings"] = {};
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
      holdingsSnapshot[sym] = { shares, price, value };
    }

    dailyPortfolio.push({
      date,
      totalValue: stockValue,
      stockValue,
      holdings: holdingsSnapshot,
    });
  }

  // Cost basis of active holdings at the end
  const finalInvested = Object.values(costBases).reduce((acc, item) => acc + item.cost, 0);

  const values = dailyPortfolio.map(d => d.totalValue).filter(v => v > 0);
  const peakValue = Math.max(...values, 0);
  const lastEntry = dailyPortfolio[dailyPortfolio.length - 1];
  const currentValue = lastEntry?.totalValue || 0;
  const holdingReturn = finalInvested > 0 ? ((currentValue - finalInvested) / finalInvested) * 100 : 0;
  const uniqueStocks = Object.keys(holdings).filter(s => s !== "$CASH");

  // ─── Anomaly Detection / Reconciliation ───
  const reconciliationWarnings = new Set<string>();
  for (let i = 1; i < dailyPortfolio.length; i++) {
    const prevDay = dailyPortfolio[i - 1];
    const currDay = dailyPortfolio[i];

    for (const [sym, currHolding] of Object.entries(currDay.holdings)) {
      const prevHolding = prevDay.holdings[sym];
      if (prevHolding && prevHolding.value > 0 && currHolding.value > 0) {
        // Calculate net trade value for this specific stock today
        let tradeNetValue = 0;
        const dayTrades = tradesByDate.get(currDay.date) || [];
        for (const t of dayTrades) {
          if (t.symbol === sym) {
            tradeNetValue += (t.side.toLowerCase() === "buy" ? 1 : -1) * t.qty * t.fillPrice;
          }
        }
        
        const expectedValue = prevHolding.value + tradeNetValue;
        if (expectedValue > 0) {
          const ratio = currHolding.value / expectedValue;
          // Check for > 25% surge or drop
          if (ratio > 1.25 || ratio < 0.75) {
            // Did a corporate action happen around this date?
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
      uniqueStocks,
      dateRange: { start: startDate, end: endDate },
    },
    tradeLog: trades,
    symbolMap,
    reconciliationWarnings: Array.from(reconciliationWarnings),
  };
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

export const analyzePortfolio = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === "OPTIONS") {
        res.status(204).send("");
        return;
      }
      if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
      }

      try {
        const files: Record<string, Buffer> = {};
        const bb = Busboy({ headers: req.headers });

        await new Promise<void>((resolve, reject) => {
          bb.on("file", (fieldname: string, file: NodeJS.ReadableStream) => {
            const chunks: Buffer[] = [];
            file.on("data", (d) => chunks.push(d));
            file.on("end", () => { files[fieldname] = Buffer.concat(chunks); });
          });
          bb.on("finish", resolve);
          bb.on("error", reject);

          if ((req as any).rawBody) {
            bb.end((req as any).rawBody);
          } else {
            req.pipe(bb);
          }
        });

        if (!files["trades"]) {
          res.status(400).json({ error: "trades file is required" });
          return;
        }

        const trades = parseTrades(files["trades"]);
        const corporateActions = files["actions"] ? parseCorporateActions(files["actions"]) : [];
        
        let prices: PriceRecord[];
        if (files["prices"]) {
          prices = parsePrices(files["prices"]);
        } else {
          // Map to minimal interfaces expected by fetchHistoricalPrices
          const minimalTrades = trades.map(t => ({ symbol: t.symbol, date: t.date }));
          const minimalActions = corporateActions.map(a => ({ symbol: a.symbol, date: a.date }));
          prices = await fetchHistoricalPrices(minimalTrades, minimalActions);
        }

        const result = computePortfolio(trades, prices, corporateActions);
        res.status(200).json(result);
      } catch (err: any) {
        console.error("Analysis error:", err);
        res.status(500).json({ error: err.message || "Internal server error" });
      }
    });
  });

// ─── Database Wrapper Endpoints ──────────────────────────────────────────────

export const savePortfolio = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const files: Record<string, Buffer> = {};
        const fields: Record<string, string> = {};
        const bb = Busboy({ headers: req.headers });

        await new Promise<void>((resolve, reject) => {
          bb.on("file", (fieldname: string, file: NodeJS.ReadableStream) => {
            const chunks: Buffer[] = [];
            file.on("data", (d) => chunks.push(d));
            file.on("end", () => { files[fieldname] = Buffer.concat(chunks); });
          });
          bb.on("field", (name, val) => { fields[name] = val; });
          bb.on("finish", resolve);
          bb.on("error", reject);

          if ((req as any).rawBody) {
            bb.end((req as any).rawBody);
          } else {
            req.pipe(bb);
          }
        });

        const portfolioId = fields["portfolioId"];
        if (!portfolioId) { res.status(400).json({ error: "portfolioId is required" }); return; }
        if (!files["trades"]) { res.status(400).json({ error: "trades file is required" }); return; }

        const trades = parseTrades(files["trades"]);
        const actions = files["actions"] ? parseCorporateActions(files["actions"]) : [];

        const db = getFirestore(admin.app(), "default");
        await db.collection("portfolios").doc(portfolioId).set({
          trades,
          actions,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(200).json({ success: true });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  });

export const listPortfolios = functions
  .runWith({ memory: "256MB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "GET") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const db = getFirestore(admin.app(), "default");
        const snap = await db.collection("portfolios").get();
        const portfolios = snap.docs.map(doc => doc.id);
        res.status(200).json({ portfolios });
      } catch (err: any) {
        res.status(500).json({ error: err.message });
      }
    });
  });

export const analyzePortfolioDB = functions
  .runWith({ timeoutSeconds: 540, memory: "1GB" })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method !== "POST") { res.status(405).json({ error: "Method not allowed" }); return; }
      try {
        const { portfolioId } = req.body;
        if (!portfolioId) { res.status(400).json({ error: "portfolioId is required" }); return; }

        const db = getFirestore(admin.app(), "default");
        const doc = await db.collection("portfolios").doc(portfolioId).get();
        if (!doc.exists) { res.status(404).json({ error: "Portfolio not found" }); return; }

        const data = doc.data();
        const trades: Trade[] = data?.trades || [];
        const actions: CorporateAction[] = data?.actions || [];

        // Fetch prices from Yahoo Finance
        const minimalTrades = trades.map(t => ({ symbol: t.symbol, date: t.date }));
        const minimalActions = actions.map(a => ({ symbol: a.symbol, date: a.date }));
        const prices = await fetchHistoricalPrices(minimalTrades, minimalActions);

        // Handoff to core engine
        const result = computePortfolio(trades, prices, actions);
        res.status(200).json(result);
      } catch (err: any) {
        console.error("DB Analysis error:", err);
        res.status(500).json({ error: err.message });
      }
    });
  });

// ─── Advanced Endpoints ──────────────────────────────────────────────────────
export * from "./advancedEndpoints";
