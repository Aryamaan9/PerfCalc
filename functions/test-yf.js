const YahooFinance = require("yahoo-finance2").default;
const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

async function test() {
  try {
    const chart = await yf.chart("AAPL", { period1: "2019-01-01", events: "div,splits" });
    console.log("Chart Divs:", chart.events?.dividends ? Object.values(chart.events.dividends).slice(0, 2) : "None");
    console.log("Chart Splits:", chart.events?.splits ? Object.values(chart.events.splits).slice(0, 2) : "None");
  } catch(e) {
    console.error(e);
  }
}
test();
