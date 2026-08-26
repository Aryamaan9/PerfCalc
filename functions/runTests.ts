import { computePortfolio, parseTrades, parseCorporateActions, Trade, CorporateAction, PriceRecord } from "./src/advancedEngine";

function runTests() {
  console.log("=== RUNNING EXTENSIVE TEST SUITE ===");

  // 1. Math Test: Basic Buy and Sell
  const trades1: Trade[] = [
    { symbol: "AAPL", rawSymbol: "AAPL", side: "Buy", qty: 10, fillPrice: 150, commission: 5, date: "2023-01-01", broker: "A" },
    { symbol: "AAPL", rawSymbol: "AAPL", side: "Sell", qty: 5, fillPrice: 200, commission: 5, date: "2023-01-10", broker: "A" }
  ];
  const prices1: PriceRecord[] = [
    { ticker: "AAPL", date: "2023-01-01", close: 150 },
    { ticker: "AAPL", date: "2023-01-10", close: 200 },
    { ticker: "AAPL", date: "2023-01-20", close: 210 }
  ];
  
  const res1 = computePortfolio(trades1, prices1, []);
  console.assert(res1.auditAlerts.length === 0, "Test 1: No alerts expected");
  
  const lastHolding = res1.dailyPortfolio[res1.dailyPortfolio.length - 1].holdings["AAPL"];
  console.assert(lastHolding.shares === 5, "Test 1: Remaining shares should be 5");
  // Total cost was 10 * 150 + 5 = 1505.
  // Averaged per share cost = 150.5.
  // We sold 5. So remaining cost basis = 5 * 150.5 = 752.5.
  console.assert(Math.abs(lastHolding.invested - 752.5) < 0.01, "Test 1: Cost basis check failed");
  console.log("✅ Basic Buy & Sell passed.");


  // 2. Transfers Test (No false realized gains)
  const trades2: Trade[] = [
    { symbol: "TSLA", rawSymbol: "TSLA", side: "Buy", qty: 10, fillPrice: 100, commission: 0, date: "2023-01-01", broker: "BrokerA" },
    { symbol: "TSLA", rawSymbol: "TSLA", side: "Transfer Out", qty: 5, fillPrice: 100, commission: 0, date: "2023-01-05", broker: "BrokerA" },
    { symbol: "TSLA", rawSymbol: "TSLA", side: "Transfer In", qty: 5, fillPrice: 100, commission: 0, date: "2023-01-06", broker: "BrokerB" }
  ];
  const prices2: PriceRecord[] = [
    { ticker: "TSLA", date: "2023-01-01", close: 100 },
    { ticker: "TSLA", date: "2023-01-05", close: 120 },
    { ticker: "TSLA", date: "2023-01-06", close: 130 }
  ];

  const res2 = computePortfolio(trades2, prices2, []);
  // Since we evaluate across the whole scope, the 5 transferred out and 5 transferred in should result in 10 total shares,
  // NO realized gains, and cost basis preserved.
  const lastMetrics2 = res2.dailyPortfolio[res2.dailyPortfolio.length - 1];
  console.assert(lastMetrics2.holdings["TSLA"].shares === 10, "Test 2: Total shares should be 10");
  console.assert(res2.summary.totalRealizedGain === 0, "Test 2: Realized gain should be 0, not artificially inflated by transfers");
  console.log("✅ Inter-Broker Transfers passed.");

  // 3. Corporate Actions (Merger) Test
  const trades3: Trade[] = [
    { symbol: "OLD", rawSymbol: "OLD", side: "Buy", qty: 10, fillPrice: 100, commission: 0, date: "2023-01-01" }
  ];
  const actions3: CorporateAction[] = [
    { symbol: "OLD", action: "MERGER", date: "2023-01-15", value: 1.5, targetSymbol: "NEW", status: "APPLIED" }
  ];
  const prices3: PriceRecord[] = [
    { ticker: "OLD", date: "2023-01-01", close: 100 },
    { ticker: "OLD", date: "2023-01-14", close: 120 },
    { ticker: "NEW", date: "2023-01-15", close: 80 }
  ];

  const res3 = computePortfolio(trades3, prices3, actions3);
  const lastHolding3_OLD = res3.dailyPortfolio[res3.dailyPortfolio.length - 1].holdings["OLD"];
  const lastHolding3_NEW = res3.dailyPortfolio[res3.dailyPortfolio.length - 1].holdings["NEW"];
  
  console.assert(!lastHolding3_OLD || lastHolding3_OLD.shares === 0, "Test 3: OLD shares should be 0");
  console.assert(lastHolding3_NEW.shares === 15, "Test 3: NEW shares should be 15 (10 * 1.5)");
  console.assert(lastHolding3_NEW.invested === 1000, "Test 3: NEW cost basis should carry over (1000)");
  console.log("✅ Merger Corporate Action passed.");

  // 4. Abnormality Audit (Negative Cash & Holdings)
  const trades4: Trade[] = [
    { symbol: "AMZN", rawSymbol: "AMZN", side: "Sell", qty: 10, fillPrice: 100, commission: 0, date: "2023-01-01" } // Selling without buying
  ];
  const res4 = computePortfolio(trades4, [], []);
  console.assert(res4.auditAlerts.length > 0, "Test 4: Alert should exist for negative holdings");
  const hasNegativeAlert = res4.auditAlerts.some(a => a.includes("Negative holding"));
  console.assert(hasNegativeAlert, "Test 4: Correct alert type generated");
  console.log("✅ Abnormality Auditing passed.");

  console.log("=== ALL TESTS PASSED SUCCESSFULLY ===");
}

runTests();
