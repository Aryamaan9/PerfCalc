import YahooFinance from 'yahoo-finance2';
const yahooFinance = new YahooFinance();

export interface MinimalTrade {
  symbol: string;
  date: string;
}

export interface MinimalCorporateAction {
  symbol: string;
  date: string;
}

export interface PriceRecord {
  ticker: string;
  date: string;
  close: number;
}

export async function fetchHistoricalPrices(
  trades: MinimalTrade[],
  actions: MinimalCorporateAction[]
): Promise<PriceRecord[]> {
  const symbols = new Set<string>();
  
  // Extract unique symbols from trades and actions
  for (const t of trades) {
    if (t.symbol !== "$CASH") symbols.add(t.symbol);
  }
  for (const a of actions) {
    if (a.symbol !== "$CASH") symbols.add(a.symbol);
  }

  const uniqueSymbols = Array.from(symbols);
  if (uniqueSymbols.length === 0) return [];

  // Find min date and max date
  let minDate = new Date().toISOString().slice(0, 10);
  let maxDate = "1970-01-01";

  for (const t of trades) {
    if (t.date < minDate) minDate = t.date;
    if (t.date > maxDate) maxDate = t.date;
  }
  for (const a of actions) {
    if (a.date < minDate) minDate = a.date;
    if (a.date > maxDate) maxDate = a.date;
  }

  // Go back 5 days to ensure we have prices leading up to the first trade
  const startDateObj = new Date(minDate);
  startDateObj.setDate(startDateObj.getDate() - 5);
  const period1 = startDateObj.toISOString().slice(0, 10);
  
  // End date is today + 1 (to ensure we capture today's prices if available)
  const endDateObj = new Date();
  endDateObj.setDate(endDateObj.getDate() + 1);
  const period2 = endDateObj.toISOString().slice(0, 10);

  const priceRecords: PriceRecord[] = [];

  // Batch fetch to avoid rate limits (e.g. 5 at a time)
  const batchSize = 5;
  for (let i = 0; i < uniqueSymbols.length; i += batchSize) {
    const batch = uniqueSymbols.slice(i, i + batchSize);
    
    // Process batch concurrently
    const promises = batch.map(async (symbol) => {
      try {
        const results = await yahooFinance.historical(symbol, {
          period1,
          period2,
          interval: '1d',
        }) as any[];
        
        for (const res of results) {
          if (res.close) {
            priceRecords.push({
              ticker: symbol,
              date: res.date.toISOString().slice(0, 10),
              close: res.close
            });
          }
        }
      } catch (err: any) {
        console.warn(`[YahooFinanceFetcher] Failed to fetch prices for ${symbol}: ${err.message}`);
      }
    });

    await Promise.all(promises);

    // Wait a brief moment between batches (1 second) to be polite to the API
    if (i + batchSize < uniqueSymbols.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Sort chronologically for consistency
  return priceRecords.sort((a, b) => a.date.localeCompare(b.date));
}
