import YahooFinance from "yahoo-finance2";
import { CorporateAction } from "./advancedEngine";

const yf = new YahooFinance({ suppressNotices: ['ripHistorical'] });

export async function validateTickers(tickers: string[]): Promise<Record<string, boolean>> {
  const result: Record<string, boolean> = {};
  for (const ticker of tickers) {
    try {
      const quote = await yf.quote(ticker);
      result[ticker] = !!quote && !!quote.regularMarketPrice;
    } catch (e) {
      result[ticker] = false;
    }
  }
  return result;
}

export async function fetchCorporateActions(
  ticker: string,
  startDate: string,
  endDate: string
): Promise<CorporateAction[]> {
  const actions: CorporateAction[] = [];
  try {
    const chart = await yf.chart(ticker, {
      period1: startDate,
      period2: endDate,
      events: "div,splits"
    });

    if (chart.events) {
      if (chart.events.dividends) {
        for (const div of Object.values(chart.events.dividends)) {
          actions.push({
            date: div.date.toISOString().slice(0, 10),
            symbol: ticker,
            action: "DIVIDEND",
            value: div.amount,
            status: "PENDING" // Or PENDING based on flow
          });
        }
      }
      if (chart.events.splits) {
        for (const split of Object.values(chart.events.splits)) {
          // Yahoo split numerator/denominator is usually `ratio = numerator / denominator`.
          // e.g. 4 for 1 => numerator = 4, denominator = 1 => value = 4.
          const value = split.numerator / split.denominator;
          actions.push({
            date: split.date.toISOString().slice(0, 10),
            symbol: ticker,
            action: "SPLIT",
            value,
            ratio: split.splitRatio,
            status: "PENDING"
          });
        }
      }
    }
  } catch (err) {
    console.error(`Error fetching corporate actions for ${ticker}:`, err);
  }
  return actions.sort((a, b) => a.date.localeCompare(b.date));
}
