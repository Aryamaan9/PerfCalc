const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const MONTH_MAP = {
  jan:"01",feb:"02",mar:"03",apr:"04",may:"05",jun:"06",
  jul:"07",aug:"08",sep:"09",oct:"10",nov:"11",dec:"12",
  january:"01",february:"02",march:"03",april:"04",june:"06",
  july:"07",august:"08",september:"09",october:"10",november:"11",december:"12",
};

function formatDateLocal(dt) {
  if (isNaN(dt.getTime())) return "";
  const y = dt.getFullYear();
  const m = String(dt.getMonth() + 1).padStart(2, "0");
  const d = String(dt.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function sanitizeYmd(ymd) {
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

function parseDate(raw) {
  const result = parseDateRaw(raw);
  return sanitizeYmd(result);
}

function parseDateRaw(raw) {
  if (!raw && raw !== 0) return "";
  if (raw instanceof Date) return formatDateLocal(raw);
  if (typeof raw === "number") {
    const d = XLSX.SSF.parse_date_code(raw);
    if (!d) return "";
    return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }
  const s = String(raw).trim();
  if (!s) return "";
  const datePart = s.split(/[\sT]/)[0].trim();
  if (!datePart) return "";

  const mIso = datePart.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (mIso) return `${mIso[1]}-${mIso[2].padStart(2,"0")}-${mIso[3].padStart(2,"0")}`;

  const mDmy4 = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (mDmy4) return `${mDmy4[3]}-${mDmy4[2].padStart(2,"0")}-${mDmy4[1].padStart(2,"0")}`;

  const mDmy2 = datePart.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2})$/);
  if (mDmy2) {
    const yy = parseInt(mDmy2[3]);
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mDmy2[2].padStart(2,"0")}-${mDmy2[1].padStart(2,"0")}`;
  }

  if (/^\d{8}$/.test(datePart)) {
    const first4 = parseInt(datePart.slice(0, 4));
    const last4 = parseInt(datePart.slice(4, 8));
    if (first4 >= 1900 && first4 <= 2100) return `${datePart.slice(0, 4)}-${datePart.slice(4, 6)}-${datePart.slice(6, 8)}`;
    else if (last4 >= 1900 && last4 <= 2100) return `${datePart.slice(4, 8)}-${datePart.slice(2, 4)}-${datePart.slice(0, 2)}`;
  }

  if (/^\d{5}$/.test(datePart)) {
    const num = parseInt(datePart);
    const d = XLSX.SSF.parse_date_code(num);
    if (d) return `${d.y}-${String(d.m).padStart(2,"0")}-${String(d.d).padStart(2,"0")}`;
  }

  if (/^\d{6}$/.test(datePart)) {
    const dd = datePart.slice(0, 2);
    const mm = datePart.slice(2, 4);
    const yy = parseInt(datePart.slice(4, 6));
    const yyyy = yy < 70 ? 2000 + yy : 1900 + yy;
    return `${yyyy}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
  }

  const m3 = s.match(/^(\d{1,2})[\/\-\s]([A-Za-z]{3,9})[\/\-\s,]*(\d{2,4})/);
  if (m3) {
    const mon = MONTH_MAP[m3[2].toLowerCase().slice(0, 3)];
    if (mon) {
      const yr = m3[3].length === 2 ? `20${m3[3]}` : m3[3];
      return `${yr}-${mon}-${m3[1].padStart(2,"0")}`;
    }
  }

  const m4 = s.match(/^([A-Za-z]{3,9})[\/\-\s,]*(\d{1,2})[\/\-\s,]*(\d{4})/);
  if (m4) {
    const mon = MONTH_MAP[m4[1].toLowerCase().slice(0, 3)];
    if (mon) return `${m4[3]}-${mon}-${m4[2].padStart(2,"0")}`;
  }

  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return formatDateLocal(parsed);
  return "";
}

function parseNumber(val) {
  if (val === undefined || val === null || val === "") return 0;
  if (typeof val === "number") return val;
  const clean = String(val).replace(/[^\d\.\-]/g, "");
  return parseFloat(clean) || 0;
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

function parseTrades(buf) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
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
      qty: parseNumber(r["Qty"] || r["qty"] || r["Quantity"]),
      fillPrice: parseNumber(r["Fill Price"] || r["FillPrice"] || r["Price"]),
      commission: parseNumber(r["Commission"]),
      date: d,
    };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
}

function parsePrices(buf) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  return rows.map(r => {
    const ticker = String(r["Ticker"] || r["ticker"] || r["Symbol"] || "").trim();
    if (!ticker) return null;
    const d = parseDate(r["Date"] || r["date"] || "");
    if (!d) return null;
    const vals = Object.values(r);
    const close = parseNumber(r["Close"] || r["close"] || r["Price"] || r["ClosePrice"] || vals[2]);
    if (!close) return null;
    return { ticker: ticker.toUpperCase(), date: d, close };
  }).filter(Boolean);
}

function parseCorporateActions(buf) {
  const wb = XLSX.read(buf, { type: "buffer", cellDates: false });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
  const valid = ["DIVIDEND","SPLIT","DEPOSIT","WITHDRAWAL"];
  return rows.map(r => {
    const d = parseDate(r["Date"] || r["date"] || "");
    const sym = normalizeSymbol(String(r["Symbol"] || r["symbol"] || ""));
    const action = String(r["Action"] || r["action"] || r["Type"] || "").toUpperCase().trim();
    const value = parseNumber(r["Value"] || r["value"] || r["Amount"]);
    if (!d || !valid.includes(action)) return null;
    return { date: d, symbol: sym, action, value };
  }).filter(Boolean).sort((a, b) => a.date.localeCompare(b.date));
}

function buildPriceMap(records) {
  const map = new Map();
  for (const r of records) {
    if (!map.has(r.ticker)) map.set(r.ticker, new Map());
    map.get(r.ticker).set(r.date, r.close);
  }
  return map;
}

function getPricesForSymbol(sym, rawSym, priceMap) {
  const candidates = [];
  if (sym) {
    candidates.push(sym.toUpperCase());
    const base = sym.replace(/\.(NS|BO)$/i, "").toUpperCase();
    if (base && base !== sym.toUpperCase()) candidates.push(base);
  }
  if (rawSym) {
    candidates.push(rawSym.toUpperCase());
    const baseRaw = rawSym.replace(/^(NSE|BSE):/i, "").replace(/\.(NS|BO)$/i, "").toUpperCase();
    if (baseRaw && !candidates.includes(baseRaw)) candidates.push(baseRaw);
  }
  for (const cand of candidates) {
    if (priceMap.has(cand)) return priceMap.get(cand);
  }
  return undefined;
}

function interpolatePrice(sym, rawSym, date, priceMap) {
  const prices = getPricesForSymbol(sym, rawSym, priceMap);
  if (!prices) return 0;
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

function getPriceForSymbol(sym, rawSym, date, priceMap) {
  const prices = getPricesForSymbol(sym, rawSym, priceMap);
  if (!prices) return 0;
  if (prices.has(date)) return prices.get(date);
  return interpolatePrice(sym, rawSym, date, priceMap);
}

function isPriceFileSplitAdjusted(symbol, rawSymbol, splitDate, trades, priceMap, ratio) {
  const priorTrade = trades.find(t => t.symbol === symbol && t.date < splitDate && t.side.toLowerCase() === "buy");
  if (!priorTrade) return false;
  const prices = getPricesForSymbol(symbol, rawSymbol || priorTrade.rawSymbol, priceMap);
  if (!prices) return false;
  const closePrice = prices.get(priorTrade.date) || interpolatePrice(symbol, rawSymbol || priorTrade.rawSymbol, priorTrade.date, priceMap);
  if (closePrice <= 0) return false;
  const ratioInFile = priorTrade.fillPrice / closePrice;
  return Math.abs(ratioInFile - ratio) < Math.abs(ratioInFile - 1);
}

function computePortfolio(rawTrades, prices, rawActions) {
  const trades = rawTrades.map(t => ({ ...t }));
  const corporateActions = rawActions.map(a => ({ ...a }));
  const priceMap = buildPriceMap(prices);

  const retrospectivelyAppliedSplits = new Set();
  const splits = corporateActions.filter(a => a.action === "SPLIT").sort((a, b) => a.date.localeCompare(b.date));

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

  const allDates = new Set([...trades.map(t => t.date), ...prices.map(p => p.date), ...corporateActions.map(a => a.date)]);
  const sorted = Array.from(allDates).sort();
  const fullDates = [];
  let cur = sorted[0];
  const end = sorted[sorted.length - 1];
  while (cur <= end) { fullDates.push(cur); cur = addDays(cur, 1); }

  const holdings = {};
  const costBases = {};
  let totalDividends = 0;

  const tradesByDate = new Map();
  const actionsByDate = new Map();
  for (const t of trades) {
    if (!tradesByDate.has(t.date)) tradesByDate.set(t.date, []);
    tradesByDate.get(t.date).push(t);
  }
  for (const a of corporateActions) {
    if (!actionsByDate.has(a.date)) actionsByDate.set(a.date, []);
    actionsByDate.get(a.date).push(a);
  }

  const dailyPortfolio = [];
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
      } else if (a.action === "DIVIDEND") {
        totalDividends += (holdings[a.symbol] || 0) * a.value;
      }
    }

    let stockValue = 0;
    const snap = {};
    for (const [sym, shares] of Object.entries(holdings)) {
      if (shares <= 0) continue;
      const trade = trades.find(t => t.symbol === sym);
      const price = getPriceForSymbol(sym, trade?.rawSymbol, date, priceMap);
      const value = shares * price;
      stockValue += value;
      snap[sym] = { shares, price, value };
    }
    dailyPortfolio.push({ date, totalValue: stockValue, stockValue, holdings: snap });
  }

  const finalInvested = Object.values(costBases).reduce((acc, item) => acc + item.cost, 0);
  const vals = dailyPortfolio.map(d => d.totalValue).filter(v => v > 0);
  const lastEntry = dailyPortfolio[dailyPortfolio.length - 1];
  const currentValue = lastEntry?.totalValue || 0;
  const peakValue = Math.max(...vals, 0);
  const holdingReturn = finalInvested > 0 ? ((currentValue - finalInvested) / finalInvested) * 100 : 0;

  return {
    summary: {
      totalInvested: finalInvested,
      peakValue,
      currentValue,
      holdingReturn,
      totalDividends,
      uniqueStocks: Object.keys(holdings).filter(s => s !== "$CASH"),
      dateRange: { start: sorted[0], end: sorted[sorted.length-1] },
    },
    lastHoldings: lastEntry?.holdings,
    retrospectivelyAppliedSplits: Array.from(retrospectivelyAppliedSplits),
  };
}

function run(name) {
  const dir = path.join(__dirname, "..", "tests", "fixtures", name);
  const trades = parseTrades(fs.readFileSync(path.join(dir, "trades.csv")));
  const prices = parsePrices(fs.readFileSync(path.join(dir, "prices.csv")));
  const actions = parseCorporateActions(fs.readFileSync(path.join(dir, "actions.csv")));
  const res = computePortfolio(trades, prices, actions);
  console.log(`\n=== RESULTS FOR ${name} ===`);
  console.log("Summary:", res.summary);
  console.log("Last Holdings:", res.lastHoldings);
  console.log("Retroactive splits:", res.retrospectivelyAppliedSplits);
}

run("01_baseline");
run("02_corporate_actions");
run("03_edge_cases");
run("04_stress_test");
