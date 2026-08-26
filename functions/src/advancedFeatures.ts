import YahooFinance from "yahoo-finance2";
import { CorporateAction } from "./advancedEngine";
import { fetchNseCorporateActions } from "./services/nseFetcher";

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
            status: "PENDING"
          });
        }
      }
      if (chart.events.splits) {
        for (const split of Object.values(chart.events.splits)) {
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
    
    // Scrape NSE for complex events (Mergers, Demergers, Rights) if applicable
    if (ticker.endsWith(".NS")) {
      const nseActions = await fetchNseCorporateActions(ticker);
      
      // Filter NSE actions by date range
      const validNseActions = nseActions.filter(na => na.date >= startDate && na.date <= endDate);
      
      for (const nseA of validNseActions) {
        // Prevent duplicates if multiple events land on the same day with same action
        const exists = actions.some(a => a.date === nseA.date && a.action === nseA.action);
        if (!exists) {
          actions.push(nseA);
        }
      }
    }
    
  } catch (err: any) {
    console.error("Error fetching corporate actions for " + ticker + ":", err.message);
  }
  return actions.sort((a, b) => a.date.localeCompare(b.date));
}
