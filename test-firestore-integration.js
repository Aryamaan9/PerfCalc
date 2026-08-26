const fs = require('fs');

async function runTest() {
  console.log("=== Portfolio Analyzer Firestore Integration Test ===");
  
  // 1. Create a mock CSV trades file
  const tradesCSV = `Date,Symbol,Side,Quantity,Fill Price,Commission\n2022-01-10,RELIANCE.NS,Buy,10,2400,0\n2023-05-15,RELIANCE.NS,Sell,5,2500,0\n`;
  fs.writeFileSync('mock-trades.csv', tradesCSV);
  
  const projectId = 'portfolio-analyzer';
  const region = 'us-central1';
  // Note: the port might be 5001. We'll use 5001 as default for firebase functions emulator.
  const baseUrl = `http://127.0.0.1:5001/${projectId}/${region}`;

  try {
    // Test 1: Save Portfolio
    console.log("\\n1. Testing savePortfolio endpoint...");
    const saveFormData = new FormData();
    saveFormData.append("portfolioId", "test-fund");
    
    // Convert to Blob for fetch FormData
    const blob = new Blob([tradesCSV], { type: 'text/csv' });
    saveFormData.append("trades", blob, "mock-trades.csv");

    const saveRes = await fetch(`${baseUrl}/savePortfolio`, {
      method: 'POST',
      body: saveFormData
    });
    
    if (!saveRes.ok) throw new Error(`Save Failed: ${await saveRes.text()}`);
    console.log("✅ Save successful!");

    // Test 2: List Portfolios
    console.log("\\n2. Testing listPortfolios endpoint...");
    const listRes = await fetch(`${baseUrl}/listPortfolios`);
    if (!listRes.ok) throw new Error(`List Failed: ${await listRes.text()}`);
    const listData = await listRes.json();
    console.log("✅ List successful! Found portfolios:", listData.portfolios);

    // Test 3: Analyze Portfolio from DB
    console.log("\\n3. Testing analyzePortfolioDB endpoint (Wrapper Handoff)...");
    const analyzeRes = await fetch(`${baseUrl}/analyzePortfolioDB`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portfolioId: "test-fund" })
    });
    
    if (!analyzeRes.ok) throw new Error(`Analyze Failed: ${await analyzeRes.text()}`);
    const analyzeData = await analyzeRes.json();
    
    console.log("✅ Analyze successful!");
    console.log(`Returned data: ${analyzeData.dailyPortfolio.length} days simulated.`);
    console.log(`Current Portfolio Value: ₹${analyzeData.summary.currentValue}`);
    console.log(`Total Invested: ₹${analyzeData.summary.totalInvested}`);
    
    console.log("\\n🎉 All Integration Tests Passed!");
    
  } catch (err) {
    console.error("\\n❌ Test Failed:", err.message);
  } finally {
    if (fs.existsSync('mock-trades.csv')) {
      fs.unlinkSync('mock-trades.csv');
    }
  }
}

runTest();
