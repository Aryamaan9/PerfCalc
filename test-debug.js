const fs = require('fs');
const XLSX = require('xlsx');

function parseDate(raw) {
  if (!raw && raw !== 0) return "";
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(raw).trim();
  const m1 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m1) return `${m1[3]}-${m1[2].padStart(2,"0")}-${m1[1].padStart(2,"0")}`;
  const m2 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m2) return `${m2[1]}-${m2[2].padStart(2,"0")}-${m2[3].padStart(2,"0")}`;
  return s.slice(0,10);
}

function normalizeSymbol(raw) {
  if (!raw) return "";
  raw = raw.trim();
  if (raw === "$CASH") return "$CASH";
  const m = raw.match(/^(?:NSE|BSE):(.+)$/i);
  if (m) return `${m[1].toUpperCase()}.NS`;
  if (/\.(NS|BO)$/i.test(raw)) return raw.toUpperCase();
  return raw.toUpperCase();
}

function addDays(d, n) {
  const dt = new Date(d);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0,10);
}

function daysBetween(a, b) {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function buildPriceMap(records) {
  const map = new Map();
  for (const r of records) {
    if (!map.has(r.ticker)) map.set(r.ticker, new Map());
    map.get(r.ticker).set(r.date, r.close);
  }
  return map;
}

function interpolatePrice(ticker, date, priceMap) {
  const prices = priceMap.get(ticker);
  if (!prices) return 0;
  if (prices.has(date)) return prices.get(date);
  const all = Array.from(prices.keys()).sort();
  const before = all.filter(d => d < date);
  const after  = all.filter(d => d > date);
  if (before.length && after.length) {
    const bD = before[before.length-1], aD = after[0];
    const bP = prices.get(bD), aP = prices.get(aD);
    const bd = daysBetween(bD, date), ad = daysBetween(date, aD);
    return (bP * ad + aP * bd) / (bd + ad);
  }
  if (before.length) return prices.get(before[before.length-1]);
  if (after.length)  return prices.get(after[0]);
  return 0;
}

function isPriceFileSplitAdjusted(symbol, splitDate, trades, priceMap, ratio) {
  const priorTrade = trades.find(t => t.symbol === symbol && t.date < splitDate && t.side.toLowerCase() === "buy");
  if (!priorTrade) return false;

  const prices = priceMap.get(symbol);
  if (!prices) return false;

  const closePrice = prices.get(priorTrade.date) || interpolatePrice(symbol, priorTrade.date, priceMap);
  if (closePrice <= 0) return false;

  const ratioInFile = priorTrade.fillPrice / closePrice;
  const isAdjusted = Math.abs(ratioInFile - ratio) < Math.abs(ratioInFile - 1);
  console.log(`Checking split for ${symbol} on ${splitDate}. Fill Price: ${priorTrade.fillPrice}, Close in Price File: ${closePrice}. Ratio: ${ratioInFile.toFixed(2)}. Split Ratio: ${ratio}. Is price file split-adjusted? ${isAdjusted}`);
  return isAdjusted;
}

// ─── Adaptive Logic (Retrospective OR Forward Split) ─────────────────────────
function computePortfolioAdaptive(rawTrades, prices, rawCorporateActions) {
  const trades = rawTrades.map(t => ({ ...t }));
  const corporateActions = rawCorporateActions.map(a => ({ ...a }));
  const priceMap = buildPriceMap(prices);

  const retrospectivelyAppliedSplits = new Set();

  // Sort splits chronologically
  const splits = corporateActions
    .filter(a => a.action === "SPLIT")
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const split of splits) {
    const splitDate = split.date;
    const symbol = split.symbol;
    const ratio = split.value;

    if (isPriceFileSplitAdjusted(symbol, splitDate, trades, priceMap, ratio)) {
      retrospectivelyAppliedSplits.add(split);
      
      // Adjust prior trades
      for (const t of trades) {
        if (t.symbol === symbol && t.date < splitDate) {
          t.qty *= ratio;
          t.fillPrice /= ratio;
        }
      }

      // Adjust prior dividends
      for (const a of corporateActions) {
        if (a.symbol === symbol && a.date < splitDate && a.action === "DIVIDEND") {
          a.value /= ratio;
        }
      }
    }
  }

  const holdings = {};
  let cashBalance = 0;
  
  const tradesByDate  = new Map();
  const actionsByDate = new Map();

  for (const t of trades) {
    if (!tradesByDate.has(t.date)) tradesByDate.set(t.date, []);
    tradesByDate.get(t.date).push(t);
  }
  for (const a of corporateActions) {
    if (!actionsByDate.has(a.date)) actionsByDate.set(a.date, []);
    actionsByDate.get(a.date).push(a);
  }

  const allDates = new Set([...trades.map(t => t.date), ...prices.map(p => p.date), ...corporateActions.map(a => a.date)]);
  const sorted = Array.from(allDates).sort();
  
  const fullDates = [];
  let cur = sorted[0];
  const end = sorted[sorted.length - 1];
  while (cur <= end) { fullDates.push(cur); cur = addDays(cur, 1); }

  for (const date of fullDates) {
    for (const t of (tradesByDate.get(date) || [])) {
      const s = t.side.toLowerCase();
      if (t.symbol !== "$CASH") {
        if (s === "buy") {
          holdings[t.symbol] = (holdings[t.symbol] || 0) + t.qty;
          cashBalance -= t.qty * t.fillPrice;
        }
      }
    }

    for (const a of (actionsByDate.get(date) || [])) {
      if (a.action === "SPLIT") {
        if (!retObjectHas(retrospectivelyAppliedSplits, a)) { // local helper
          if (holdings[a.symbol]) {
            holdings[a.symbol] *= a.value;
          }
        }
      } else if (a.action === "DIVIDEND") {
        const div = (holdings[a.symbol] || 0) * a.value;
        cashBalance += div;
      }
    }

    if (date === "2021-03-31" || date === "2021-12-03" || date === "2022-07-02" || date === "2022-09-02") {
      const price = priceMap.get("APOLLOPIPE.NS")?.get(date) || priceMap.get("BAJFINANCE.NS")?.get(date) || 0;
      const shares = holdings["APOLLOPIPE.NS"] || holdings["BAJFINANCE.NS"] || 0;
      console.log(`[${date}] Shares: ${shares.toFixed(0)}, Price: ${price}, Stock Value: ${shares * price}, Cash: ${cashBalance}`);
    }
  }

  function retObjectHas(set, item) {
    for (const s of set) {
      if (s.date === item.date && s.symbol === item.symbol && s.action === item.action && s.value === item.value) {
        return true;
      }
    }
    return false;
  }
}

// Test cases
console.log("=== CASE 1: Split-Adjusted Price File (like Yahoo Finance for APOLLOPIPE) ===");
const trades1 = [{ symbol: "APOLLOPIPE.NS", side: "Buy", qty: 500, fillPrice: 913.85, date: "2021-03-31" }];
const prices1 = [
  { ticker: "APOLLOPIPE.NS", date: "2021-03-31", close: 329.47 },
  { ticker: "APOLLOPIPE.NS", date: "2021-12-03", close: 340.00 }
];
const actions1 = [{ symbol: "APOLLOPIPE.NS", action: "SPLIT", value: 3, date: "2021-12-02" }];
computePortfolioAdaptive(trades1, prices1, actions1);

console.log("\n=== CASE 2: Unadjusted Price File (like our Template for BAJFINANCE) ===");
const trades2 = [{ symbol: "BAJFINANCE.NS", side: "Buy", qty: 150, fillPrice: 5376.31, date: "2022-07-01" }];
const prices2 = [
  { ticker: "BAJFINANCE.NS", date: "2022-07-01", close: 5376.31 },
  { ticker: "BAJFINANCE.NS", date: "2022-07-02", close: 5400.00 },
  { ticker: "BAJFINANCE.NS", date: "2022-09-02", close: 5450.00 }
];
const actions2 = [{ symbol: "BAJFINANCE.NS", action: "SPLIT", value: 2, date: "2022-09-01" }];
computePortfolioAdaptive(trades2, prices2, actions2);
