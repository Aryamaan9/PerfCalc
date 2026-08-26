# Core Engine Architecture & Mathematics (`advancedEngine.ts`)

The Core Engine is the mathematical heart of the Portfolio Analyzer. It operates strictly on a **Chronological Daily Ledger** principle. Rather than calculating current values directly, the engine starts from the date of the very first trade and steps forward day-by-day up to the present, maintaining state exactly as a real brokerage account would.

## 1. Engine Data Flow

```mermaid
flowchart TD
    A[Raw Trades CSV/JSON] --> C[Engine Ingestion]
    B[Raw Historical Prices CSV/JSON] --> C
    
    C --> D[Chronological Sorting]
    D --> E{Daily Loop (Day 1 to Present)}
    
    E --> F[Apply Trades for the Day]
    F --> G[Update Cash & Share Balances]
    G --> H[Fetch Closing Prices for the Day]
    H -->|Missing Price?| I[Interpolate (Carry Forward Last Known)]
    H --> J[Calculate Daily Total Value]
    I --> J
    J --> K[Push to Daily Portfolio Array]
    K --> E
    
    E -->|Loop Finishes| L[Generate Final Summary]
    L --> M[Export AnalysisResult Object]
```

## 2. Mathematical Logic & State Tracking

During the daily loop, the engine tracks two primary metrics for every ticker: `Holdings (Shares)` and `Cash Balance`.

### A. Cash Balance Math
The `$CASH` balance acts as the definitive measure of how much fiat currency is in the account.
- **Buy / Transfer In:** `Cash Balance -= (Qty * Fill Price) + Commission`
- **Sell / Transfer Out:** `Cash Balance += (Qty * Fill Price) - Commission`
- **Dividend Payout (Synthetic Trade):** `Cash Balance += Qty` (Since Fill Price is strictly 1 for dividends)

*Note: Total Invested Capital at any given point is equivalent to the net negative Cash Balance (i.e., how much cash was consumed by purchasing assets).*

### B. Share Balance (Holdings) Math
- **Buy / Transfer In / Bonus Issue:** `Shares += Qty`
- **Sell / Transfer Out / Merger Swap:** `Shares -= Qty`
- **Split Adjust (Synthetic):** `Shares += Qty` (Where Qty is calculated as `Shares Held * (Split Ratio - 1)`)

### C. Price Interpolation
Stock markets close on weekends and holidays. If a user holds a stock on a Saturday, the engine still needs to calculate the portfolio's Total Value for that day.
- **Rule:** If a strict closing price is missing for `Date X`, the engine looks backward up to 10 days to find the last known closing price (`Date X-1`).
- **Math:** `Price(Saturday) = Price(Friday)`

## 3. Daily Portfolio Valuation
At the end of every simulated day, the engine takes a snapshot of the portfolio's net worth:
```text
Daily Total Value = Cash Balance + Sum(Shares Held of Ticker i * Interpolated Price of Ticker i)
```
This array of daily values is passed to the frontend to draw the main performance chart.

## 4. Final Summary Metrics
Once the engine reaches the present day, it calculates the overarching summary metrics:

1. **Current Value:** The `Daily Total Value` on the very last day of the loop.
2. **Peak Value:** The highest recorded `Daily Total Value` across the entire timeline.
3. **Total Dividends:** Sum of all quantities from `Dividend Payout` synthetic trades.
4. **Holding Return (Percentage):**
   ```text
   Holding Return = ((Current Value + Total Dividends - Total Invested) / Total Invested) * 100
   ```
