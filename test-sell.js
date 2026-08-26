const fs = require("fs");
const XLSX = require("xlsx");

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

function parseTrades(buf) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows.map(r => {
    const sym = String(r["Symbol"] || r["symbol"] || "").trim();
    if (!sym) return null;
    const d = parseDate(r["Closing Time"] || r["Date"] || r["date"] || r["ClosingTime"] || "");
    if (!d) return null;
    const sideRaw = String(r["Side"] || r["side"] || r["Type"] || "").trim().toLowerCase();
    if (sideRaw !== "buy" && sideRaw !== "sell") return null;
    return {
      rawSymbol: sym,
      symbol: normalizeSymbol(sym),
      side: sideRaw === "buy" ? "Buy" : "Sell",
      qty: parseFloat(String(r["Qty"] || r["qty"] || r["Quantity"] || 0)) || 0,
      fillPrice: parseFloat(String(r["Fill Price"] || r["FillPrice"] || r["Price"] || 0)) || 0,
      commission: parseFloat(String(r["Commission"] || 0)) || 0,
      date: d,
    };
  }).filter(Boolean).sort((a, b) => {
    const dateComp = a.date.localeCompare(b.date);
    if (dateComp !== 0) return dateComp;
    if (a.side === "Buy" && b.side === "Sell") return -1;
    if (a.side === "Sell" && b.side === "Buy") return 1;
    return 0;
  });
}

function parsePrices(buf) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return rows.map(r => {
    const ticker = String(r["Ticker"] || r["ticker"] || r["Symbol"] || "").trim();
    if (!ticker) return null;
    const d = parseDate(r["Date"] || r["date"] || "");
    if (!d) return null;
    const vals = Object.values(r);
    const close = parseFloat(String(r["Close"] || r["close"] || r["Price"] || r["ClosePrice"] || vals[2] || 0)) || 0;
    if (!close) return null;
    return { ticker: ticker.toUpperCase(), date: d, close };
  }).filter(Boolean);
}

function parseCorporateActions(buf) {
  const wb = XLSX.read(buf, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  const valid = ["DIVIDEND","SPLIT","DEPOSIT","WITHDRAWAL"];
  return rows.map(r => {
    const d = parseDate(r["Date"] || r["date"] || "");
    const sym = normalizeSymbol(String(r["Symbol"] || r["symbol"] || ""));
    const action = String(r["Action"] || r["action"] || r["Type"] || "").toUpperCase().trim();
    const value = parseFloat(String(r["Value"] || r["value"] || r["Amount"] || 0)) || 0;
    if (!d || !valid.includes(action)) return null;
    return { date: d, symbol: sym, action, value };
  }).filter(Boolean).sort((a,b) => a.date.localeCompare(b.date));
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
  return Math.abs(ratioInFile - ratio) < Math.abs(ratioInFile - 1);
}

const tradesBuf = fs.readFileSync("public/trades_template.xlsx");
const pricesBuf = fs.readFileSync("public/prices_template.xlsx");
const actionsBuf = fs.readFileSync("public/actions_template.xlsx");

const trades = parseTrades(tradesBuf);
const prices = parsePrices(pricesBuf);
const corporateActions = parseCorporateActions(actionsBuf);

console.log("Parsed Trades Count:", trades.length);
console.log("AUBANK trades:");
console.log(trades.filter(t => t.symbol.includes("AUBANK")));

const priceMap = buildPriceMap(prices);
const retrospectivelyAppliedSplits = new Set();
const splits = corporateActions.filter(a => a.action === "SPLIT").sort((a, b) => a.date.localeCompare(b.date));

for (const split of splits) {
  const splitDate = split.date;
  const symbol = split.symbol;
  const ratio = split.value;
  if (isPriceFileSplitAdjusted(symbol, splitDate, trades, priceMap, ratio)) {
    retrospectivelyAppliedSplits.add(split);
    for (const t of trades) {
      if (t.symbol === symbol && t.date < splitDate) {
        t.qty *= ratio;
        t.fillPrice /= ratio;
      }
    }
  }
}

console.log("After Split Adjustment, Trades:");
console.log(trades.filter(t => t.date === "2021-03-31" || t.date === "2021-04-07"));

const allDates = new Set([...trades.map(t => t.date), ...prices.map(p => p.date), ...corporateActions.map(a => a.date)]);
const sorted = Array.from(allDates).sort();
const fullDates = [];
let cur = sorted[0];
const end = sorted[sorted.length - 1];
while (cur <= end) { fullDates.push(cur); cur = addDays(cur, 1); }

const holdings = {};
const costBases = {};

const tradesByDate = new Map();
for (const t of trades) {
  if (!tradesByDate.has(t.date)) tradesByDate.set(t.date, []);
  tradesByDate.get(t.date).push(t);
}
const actionsByDate = new Map();
for (const a of corporateActions) {
  if (!actionsByDate.has(a.date)) actionsByDate.set(a.date, []);
  actionsByDate.get(a.date).push(a);
}

for (const date of fullDates) {
  for (const t of (tradesByDate.get(date) || [])) {
    const s = t.side.toLowerCase();
    if (t.symbol !== "$CASH") {
      if (s === "buy") {
        holdings[t.symbol] = (holdings[t.symbol] || 0) + t.qty;
        const cost = t.qty * t.fillPrice + t.commission;
        if (!costBases[t.symbol]) costBases[t.symbol] = { shares: 0, cost: 0 };
        costBases[t.symbol].shares += t.qty;
        costBases[t.symbol].cost += cost;
      } else if (s === "sell") {
        holdings[t.symbol] = Math.max(0, (holdings[t.symbol] || 0) - t.qty);
        if (costBases[t.symbol] && costBases[t.symbol].shares > 0) {
          const avgPrice = costBases[t.symbol].cost / costBases[t.symbol].shares;
          costBases[t.symbol].shares = Math.max(0, costBases[t.symbol].shares - t.qty);
          costBases[t.symbol].cost = costBases[t.symbol].shares * avgPrice;
        }
      }
    }
  }

  for (const a of (actionsByDate.get(date) || [])) {
    if (a.action === "SPLIT") {
      if (!retrospectivelyAppliedSplits.has(a)) {
        if (holdings[a.symbol]) holdings[a.symbol] *= a.value;
        if (costBases[a.symbol]) costBases[a.symbol].shares *= a.value;
      }
    }
  }

    if (date >= "2021-05-20" && date <= "2021-05-30") {
      if (holdings["AUBANK.NS"]) {
        const price = priceMap.get("AUBANK.NS")?.get(date) || interpolatePrice("AUBANK.NS", date, priceMap);
        console.log(`Date: ${date}, AUBANK.NS Shares: ${holdings["AUBANK.NS"]}, Price: ${price}, Value: ${holdings["AUBANK.NS"] * price}`);
      } else {
        console.log(`Date: ${date}, AUBANK.NS Shares: 0`);
      }
    }
}
