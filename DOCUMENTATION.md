# Portfolio Analyzer: Technical Architecture & Documentation

This document serves as the absolute source of truth for the technical architecture, mathematical logic, and development guardrails of the Money Stories Portfolio Analyzer platform. 

Due to the financial nature of this application, **mathematical accuracy is the highest priority**. Any future changes must strictly adhere to the logic and guardrails defined here.

---

## 1. System Overview (Stateless Architecture)

The application currently operates on a **stateless, in-memory architecture**. There is no traditional relational or document database persisting the calculated data. 

**The Data Flow:**
1. **Ingestion:** User uploads raw CSV/Excel files (Trades, Prices, Actions) via the Next.js frontend (`src/app/page.tsx`).
2. **Transmission:** Files are sent to the Firebase Cloud Function (`/api/analyze`) using `multipart/form-data`.
3. **Parsing:** The backend parses dates (handling multiple formats) and normalizes ticker symbols (e.g., `NSE:AUBANK` → `AUBANK.NS`).
4. **Simulation:** The core engine (`computePortfolio`) chronologically simulates the portfolio from the very first trade date up to the present day.
5. **Delivery:** The massive generated JSON array containing daily snapshots is sent back to the frontend and held in React State for rendering via `Chart.js`.

---

## 2. Core Calculation Engine (`computePortfolio`)

**Location:** `functions/src/index.ts` (Lines ~400-600)

The engine does not rely on static snapshots; it uses a **Time Travel** mechanism to guarantee accuracy.

### Step-by-Step Logic:
1. **Timeline Generation:** It extracts all unique dates from trades, prices, and corporate actions. It then interpolates every single calendar day between the absolute minimum date and the maximum date.
2. **Daily Iteration:** It steps through this timeline chronologically (`for (const date of fullDates)`).
3. **Trade Application:** On any given day, if a trade occurred:
   - **Buy:** Increments the share count in the `holdings` ledger. Increases the total cost basis.
   - **Sell:** Decrements the share count. Calculates the average cost basis of the sold shares and deducts it from the total cost basis to ensure ROI (Holding Return) is accurate.
4. **Market Valuation:** For every active holding on that day, it fetches the closing price.
   - *Interpolation Guardrail:* If exact pricing data is missing for a specific date (e.g., weekends, market holidays), it calculates a weighted average based on the nearest previous and subsequent available prices.
   - `Market Value = Current Shares Held * Closing Price`
5. **Snapshotting:** The sum of all active market values is pushed into the `dailyPortfolio` array.

---

## 3. Corporate Actions Engine

Corporate actions significantly alter historical calculations. The engine handles them with high precision.

### Stock Splits & Bonus Issues
*Mathematical Challenge:* If a user bought 10 shares at ₹100, and a 2:1 split occurs, the current price is ₹50. Without adjustment, the portfolio would erroneously show a 50% loss.
* **The Retroactive Fix (`isPriceFileSplitAdjusted`):** The engine checks if the historical price data being used (e.g., from Yahoo Finance) is *already split-adjusted*. 
* If it is, the engine goes back in time and multiplies the raw traded share quantity by the split ratio, whilst halving the purchase price. 
* *Result:* The total capital invested remains identical, but the historical share count aligns with modern split-adjusted prices.

### Cash Dividends
On the ex-dividend date, the engine reads the active share count from the `holdings` ledger, multiplies it by the dividend value, and adds the sum to the global `totalDividends` accumulator.

---

## 4. Yahoo Finance Auto-Fetcher (New Feature)

**Location:** `functions/src/services/yahooFinanceFetcher.ts`

To eliminate the manual labor of uploading historical price CSVs, the system integrates `yahoo-finance2`.

### Logic & Guardrails:
1. **Trigger:** Activated seamlessly if the user does not attach a `prices` file in the frontend upload.
2. **Extraction:** It scans the `trades` payload, extracting an array of unique `.NS` or `.BO` ticker symbols.
3. **Batching Guardrail:** Yahoo Finance has rate limits. The script splits the unique symbols into batches of 5. It uses `Promise.all` to fetch a batch concurrently, then pauses for `1000ms` before fetching the next batch. This guarantees zero IP bans or HTTP 429 Too Many Requests errors.
4. **Data Normalization:** The fetched data is mapped perfectly into the `PriceRecord[]` interface, completely tricking the `computePortfolio` engine into thinking a perfectly formatted CSV was uploaded.

---

## 5. Anomaly Detection Auditor (Reconciliation)

**Location:** `functions/src/index.ts` (End of `computePortfolio`)

Due to the risk of erroneous corporate action entries (e.g., a user manually typing a 10:1 split instead of 1:10), the engine includes an automated auditor.

### Logic & Guardrails:
1. **Day-over-Day Scan:** After the entire timeline is simulated, the auditor iterates over the `dailyPortfolio` array.
2. **Trade Insulation:** It calculates the "expected value" of a stock holding on Day 2 by taking Day 1's value and adding/subtracting any manual trades the user executed on Day 2.
3. **Volatility Check:** It compares the actual value against the expected value. If the ratio swings by more than **25%** (`> 1.25` or `< 0.75`), a red flag is raised.
4. **Corporate Action Correlation:** It scans the `corporateActions` array to see if an event occurred within 5 days of this violent swing. 
5. **Output:** If correlated, it pushes a critical string to `reconciliationWarnings`. The frontend UI catches this array and renders a permanent red banner warning the user to verify their split ratios.

---

## 6. Proposed Firestore Database Architecture (Zero-Breakage)

If persistence is required in the future, it **must** be implemented via a "Wrapper Architecture" to prevent disruption to the `computePortfolio` math.

1. **The Wrapper Endpoint:** A new Cloud Function (`/api/analyzeFromDB`) will be created.
2. **Data Sourcing:** It will fetch trades and manual actions from a Firestore collection (`portfolios/{userId}`).
3. **The Handoff:** It will format the Firestore documents into the exact `Trade[]` array structure, and hand it to `computePortfolio(trades, prices, actions)`.
4. **Safety Guarantee:** The core math engine will never directly query a database. It must remain a pure function that takes arrays and returns arrays. 

---

## 7. Strict Development Rules

Any AI agent or developer touching this codebase MUST adhere to:
1. **No Assumption Policy:** Never assume how financial data behaves. If unsure about cost-basis or split logic, stop and ask.
2. **Hyper-Localized Modularity:** Build new features in isolated files (like `yahooFinanceFetcher.ts`). Do not refactor massive working functions just for aesthetic cleanliness. 
3. **Test Extreme Edge Cases:** If altering `computePortfolio`, mentally dry-run how your change handles a stock dropping to ₹0, a missing date, or a negative quantity.
