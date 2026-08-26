const XLSX = require("xlsx");
const path = require("path");

const publicDir = path.join(__dirname, "public");

// 1. Trades Template
const tradesData = [
  ["Symbol", "Side", "Qty", "Fill Price", "Commission", "Closing Time"],
  ["NSE:APOLLOPIPE", "Buy", 500, 913.85, 0, "31-03-2021"],
  ["NSE:APOLLOPIPE", "Sell", 500, 990.65, 0, "07-04-2021"],
  ["NSE:AUBANK", "Sell", 5, 959.53, 0, "26-05-2021"],
  ["NSE:AUBANK", "Buy", 5, 962.52, 0, "26-05-2021"],
  ["NSE:AUBANK", "Buy", 395, 963.72, 0, "26-05-2021"],
  ["NSE:AUBANK", "Buy", 125, 963.95, 0, "26-05-2021"],
  ["NSE:AUBANK", "Sell", 220, 1209.52, 0, "30-07-2021"],
  ["NSE:AUBANK", "Sell", 220, 1209.52, 0, "30-07-2021"],
  ["NSE:AUBANK", "Sell", 80, 1210.2, 0, "30-07-2021"],
  ["$CASH", "Deposit", 500000, 0, 0, "01-07-2022"],
  ["NSE:BAJFINANCE", "Buy", 150, 5376.31, 0, "01-07-2022"],
  ["NSE:BAJAJFINSV", "Buy", 75, 10975.04, 0, "01-07-2022"],
  ["$CASH", "Deposit", 500000, 0, 0, "04-07-2022"],
  ["NSE:AUBANK", "Buy", 900, 568.01, 0, "04-07-2022"],
  ["$CASH", "Deposit", 50000, 0, 0, "07-07-2022"],
  ["$CASH", "Deposit", 1100000, 0, 0, "08-07-2022"],
  ["NSE:IRFC", "Buy", 20000, 20.23, 0, "12-07-2022"],
  ["NSE:AUBANK", "Buy", 1100, 557.93, 0, "14-07-2022"],
  ["$CASH", "Deposit", 1030000, 0, 0, "24-08-2022"],
  ["$CASH", "Deposit", 6000, 0, 0, "07-09-2022"]
];

const wb1 = XLSX.utils.book_new();
const ws1 = XLSX.utils.aoa_to_sheet(tradesData);
XLSX.utils.book_append_sheet(wb1, ws1, "Trades");
XLSX.writeFile(wb1, path.join(publicDir, "trades_template.xlsx"));

// 2. Prices Template
const pricesData = [
  ["Ticker", "Date", "Close"],
  ["APOLLOPIPE.NS", "31-03-2021", 913.85],
  ["APOLLOPIPE.NS", "07-04-2021", 990.65],
  ["AUBANK.NS", "26-05-2021", 963.72],
  ["AUBANK.NS", "30-07-2021", 1209.52],
  ["BAJFINANCE.NS", "01-07-2022", 5376.31],
  ["BAJAJFINSV.NS", "01-07-2022", 10975.04],
  ["AUBANK.NS", "04-07-2022", 568.01],
  ["IRFC.NS", "12-07-2022", 20.23],
  ["AUBANK.NS", "14-07-2022", 557.93],
  ["BAJFINANCE.NS", "08-07-2022", 5400.1],
  ["IRFC.NS", "24-08-2022", 21.5],
  ["AUBANK.NS", "07-09-2022", 545.0],
  ["BAJAJFINSV.NS", "07-09-2022", 10800.0],
  ["IRFC.NS", "07-09-2022", 22.1]
];

const wb2 = XLSX.utils.book_new();
const ws2 = XLSX.utils.aoa_to_sheet(pricesData);
XLSX.utils.book_append_sheet(wb2, ws2, "Prices");
XLSX.writeFile(wb2, path.join(publicDir, "prices_template.xlsx"));

// 3. Actions Template
const actionsData = [
  ["Date", "Symbol", "Action", "Value"],
  ["15-06-2022", "AUBANK.NS", "DIVIDEND", 2.5],
  ["01-09-2022", "BAJFINANCE.NS", "SPLIT", 2],
  ["05-03-2023", "$CASH", "DEPOSIT", 100000],
  ["10-06-2023", "$CASH", "WITHDRAWAL", 25000],
  ["20-12-2023", "IRFC.NS", "DIVIDEND", 0.80]
];

const wb3 = XLSX.utils.book_new();
const ws3 = XLSX.utils.aoa_to_sheet(actionsData);
XLSX.utils.book_append_sheet(wb3, ws3, "Actions");
XLSX.writeFile(wb3, path.join(publicDir, "actions_template.xlsx"));

console.log("Excel templates generated successfully!");
