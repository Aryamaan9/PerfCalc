import { fetchHistoricalPrices } from "./functions/src/services/yahooFinanceFetcher";

async function run() {
  const prices = await fetchHistoricalPrices(
    [{ symbol: "AAPL", date: "2023-01-01" }],
    []
  );
  console.log(prices.length > 0 ? prices[0] : "No prices fetched");
}

run().catch(console.error);
