const yahooFinance = require('yahoo-finance2').default;

async function run() {
  try {
    const results = await yahooFinance.historical('AAPL', {
      period1: '2023-01-01',
      period2: '2023-01-10',
      interval: '1d',
    });
    console.log(results.length > 0 ? results[0] : "No prices fetched");
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
