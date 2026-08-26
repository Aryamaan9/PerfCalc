const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");

const fixturesDir = path.join(__dirname, "..", "tests", "fixtures");

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeCsvAndXlsx(dir, baseName, data, headers) {
  ensureDir(dir);
  
  // CSV
  const csvContent = [
    headers.join(","),
    ...data.map(row => row.map(cell => {
      if (typeof cell === "string" && (cell.includes(",") || cell.includes("\""))) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(","))
  ].join("\n") + "\n";
  fs.writeFileSync(path.join(dir, `${baseName}.csv`), csvContent, "utf8");

  // XLSX
  const aoa = [headers, ...data];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  XLSX.writeFile(wb, path.join(dir, `${baseName}.xlsx`));
}

// ─── 1. BASELINE DATASET ───────────────────────────────────────────────────────
const baselineDir = path.join(fixturesDir, "01_baseline");

const baselineTrades = [
  ["INFY.NS", "Buy", 100, 1500, 0, "10-01-2023"],
  ["TCS.NS", "Buy", 50, 3200, 0, "15-01-2023"],
  ["INFY.NS", "Sell", 30, 1600, 0, "20-02-2023"],
  ["HDFCBANK.NS", "Buy", 40, 1600, 0, "01-03-2023"],
];

const baselinePrices = [
  ["INFY.NS", "10-01-2023", 1500],
  ["TCS.NS", "10-01-2023", 3200],
  ["HDFCBANK.NS", "10-01-2023", 1600],
  ["INFY.NS", "15-01-2023", 1520],
  ["TCS.NS", "15-01-2023", 3200],
  ["HDFCBANK.NS", "15-01-2023", 1600],
  ["INFY.NS", "20-02-2023", 1600],
  ["TCS.NS", "20-02-2023", 3300],
  ["HDFCBANK.NS", "20-02-2023", 1620],
  ["INFY.NS", "01-03-2023", 1650],
  ["TCS.NS", "01-03-2023", 3400],
  ["HDFCBANK.NS", "01-03-2023", 1600],
  ["INFY.NS", "31-03-2023", 1700],
  ["TCS.NS", "31-03-2023", 3500],
  ["HDFCBANK.NS", "31-03-2023", 1650],
];

const baselineActions = [];

writeCsvAndXlsx(baselineDir, "trades", baselineTrades, ["Symbol", "Side", "Qty", "Fill Price", "Commission", "Closing Time"]);
writeCsvAndXlsx(baselineDir, "prices", baselinePrices, ["Ticker", "Date", "Close"]);
writeCsvAndXlsx(baselineDir, "actions", baselineActions, ["Date", "Symbol", "Action", "Value"]);

// ─── 2. CORPORATE ACTIONS DATASET ─────────────────────────────────────────────
const corporateDir = path.join(fixturesDir, "02_corporate_actions");

const corporateTrades = [
  ["RELIANCE.NS", "Buy", 100, 2400, 0, "10-01-2022"],
  ["TATAMOTORS.NS", "Buy", 100, 500, 0, "01-02-2022"],
];

const corporatePrices = [
  ["RELIANCE.NS", "10-01-2022", 2400],
  ["TATAMOTORS.NS", "10-01-2022", 500],
  ["RELIANCE.NS", "01-02-2022", 2450],
  ["TATAMOTORS.NS", "01-02-2022", 500],
  ["RELIANCE.NS", "15-06-2022", 2500],
  ["TATAMOTORS.NS", "15-06-2022", 520],
  ["RELIANCE.NS", "10-08-2022", 2550],
  ["TATAMOTORS.NS", "10-08-2022", 500],
  ["RELIANCE.NS", "01-09-2022", 1300],
  ["TATAMOTORS.NS", "01-09-2022", 500],
  ["RELIANCE.NS", "01-12-2022", 1400],
  ["TATAMOTORS.NS", "01-12-2022", 550],
  ["RELIANCE.NS", "31-12-2022", 1450],
  ["TATAMOTORS.NS", "31-12-2022", 600],
];

const corporateActions = [
  ["15-06-2022", "RELIANCE.NS", "DIVIDEND", 10],
  ["10-08-2022", "TATAMOTORS.NS", "SPLIT", 5], // 5:1 split with unadjusted price -> 400% surge alert
  ["01-09-2022", "RELIANCE.NS", "SPLIT", 2], // 2:1 split with halved price
  ["01-12-2022", "RELIANCE.NS", "DIVIDEND", 5],
];

writeCsvAndXlsx(corporateDir, "trades", corporateTrades, ["Symbol", "Side", "Qty", "Fill Price", "Commission", "Closing Time"]);
writeCsvAndXlsx(corporateDir, "prices", corporatePrices, ["Ticker", "Date", "Close"]);
writeCsvAndXlsx(corporateDir, "actions", corporateActions, ["Date", "Symbol", "Action", "Value"]);

// ─── 3. EDGE CASES DATASET ────────────────────────────────────────────────────
const edgeDir = path.join(fixturesDir, "03_edge_cases");

const edgeTrades = [
  ["NSE:WIPRO", "Buy", 50, 400, 15.50, "01-01-2023"],
  ["ITC.NS", "Buy", 100, 350, 0, "15-01-2023"],
  ["NSE:WIPRO", "Sell", 50, 420, 10.00, "01-02-2023"],
  ["ITC", "Buy", 20, 380, 5.00, "15-02-2023"],
];

const edgePrices = [
  ["WIPRO.NS", "01-01-2023", 400],
  ["ITC.NS", "01-01-2023", 340],
  ["WIPRO.NS", "15-01-2023", 410],
  ["ITC.NS", "15-01-2023", 350],
  ["WIPRO.NS", "01-02-2023", 420],
  ["ITC.NS", "01-02-2023", 360],
  ["WIPRO.NS", "28-02-2023", 430],
  ["ITC.NS", "28-02-2023", 390],
];

const edgeActions = [];

writeCsvAndXlsx(edgeDir, "trades", edgeTrades, ["Symbol", "Side", "Qty", "Fill Price", "Commission", "Closing Time"]);
writeCsvAndXlsx(edgeDir, "prices", edgePrices, ["Ticker", "Date", "Close"]);
writeCsvAndXlsx(edgeDir, "actions", edgeActions, ["Date", "Symbol", "Action", "Value"]);

// ─── 4. STRESS TEST DATASET ───────────────────────────────────────────────────
const stressDir = path.join(fixturesDir, "04_stress_test");

const tickers = [
  "SBIN.NS", "LT.NS", "AXISBANK.NS", "KOTAKBANK.NS", "MARUTI.NS",
  "SUNPHARMA.NS", "TITAN.NS", "ULTRACEMCO.NS", "ASIANPAINT.NS", "NESTLEIND.NS",
  "HCLTECH.NS", "TECHM.NS", "POWERGRID.NS", "NTPC.NS", "ONGC.NS",
  "COALINDIA.NS", "IOC.NS", "BPCL.NS", "GAIL.NS", "VEDL.NS"
];

const basePrices = {
  "SBIN.NS": 500, "LT.NS": 2000, "AXISBANK.NS": 800, "KOTAKBANK.NS": 1800, "MARUTI.NS": 8500,
  "SUNPHARMA.NS": 900, "TITAN.NS": 2400, "ULTRACEMCO.NS": 7000, "ASIANPAINT.NS": 3000, "NESTLEIND.NS": 19000,
  "HCLTECH.NS": 1100, "TECHM.NS": 1050, "POWERGRID.NS": 220, "NTPC.NS": 160, "ONGC.NS": 140,
  "COALINDIA.NS": 200, "IOC.NS": 80, "BPCL.NS": 330, "GAIL.NS": 100, "VEDL.NS": 300
};

const stressTrades = [];
const stressPrices = [];
const stressActions = [];

function toDMY(year, month, day) {
  const m = String(month).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${d}-${m}-${year}`;
}

// 1. Initial Buys for all 20 stocks in Jan 2022
tickers.forEach((sym, idx) => {
  const day = 3 + (idx % 20);
  const date = toDMY(2022, 1, day);
  const qty = 50 + (idx * 5);
  const fillPrice = basePrices[sym];
  stressTrades.push([sym, "Buy", qty, fillPrice, 10, date]);
});

// 2. Mid-period Buys and Sells in 2022 and 2023
tickers.slice(0, 10).forEach((sym, idx) => {
  const date1 = toDMY(2022, 6, 10 + idx);
  const fillPrice1 = Math.round(basePrices[sym] * 1.05);
  stressTrades.push([sym, "Buy", 20, fillPrice1, 5, date1]);

  const date2 = toDMY(2023, 3, 5 + idx);
  const fillPrice2 = Math.round(basePrices[sym] * 1.15);
  stressTrades.push([sym, "Sell", 15, fillPrice2, 5, date2]);
});

// Additional buys
tickers.slice(10, 20).forEach((sym, idx) => {
  const date = toDMY(2023, 7, 10 + idx);
  const fillPrice = Math.round(basePrices[sym] * 1.10);
  stressTrades.push([sym, "Buy", 30, fillPrice, 5, date]);
});

// 3. Corporate Actions
stressActions.push(
  ["15-05-2022", "SBIN.NS", "DIVIDEND", 7.5],
  ["20-08-2022", "TITAN.NS", "DIVIDEND", 10.0],
  ["10-11-2022", "COALINDIA.NS", "DIVIDEND", 15.0],
  ["18-04-2023", "POWERGRID.NS", "DIVIDEND", 5.0],
  ["25-06-2023", "NTPC.NS", "DIVIDEND", 4.5],
  ["12-09-2023", "MARUTI.NS", "DIVIDEND", 90.0]
);

// 4. Prices sampled every 15 days
const sampleDates = [];
for (let y = 2022; y <= 2023; y++) {
  for (let m = 1; m <= 12; m++) {
    sampleDates.push(toDMY(y, m, 1));
    sampleDates.push(toDMY(y, m, 15));
  }
}
sampleDates.push(toDMY(2023, 12, 31));

sampleDates.forEach((date, stepIdx) => {
  tickers.forEach(sym => {
    const factor = 1 + (stepIdx * 0.005) + Math.sin(stepIdx * 0.5) * 0.04;
    const close = Math.round(basePrices[sym] * factor * 100) / 100;
    stressPrices.push([sym, date, close]);
  });
});

writeCsvAndXlsx(stressDir, "trades", stressTrades, ["Symbol", "Side", "Qty", "Fill Price", "Commission", "Closing Time"]);
writeCsvAndXlsx(stressDir, "prices", stressPrices, ["Ticker", "Date", "Close"]);
writeCsvAndXlsx(stressDir, "actions", stressActions, ["Date", "Symbol", "Action", "Value"]);

console.log("All 4 fixture datasets regenerated with standard DD-MM-YYYY dates!");
