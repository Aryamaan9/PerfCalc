# Holdings Statement Architecture & Mathematics

The Holdings Statement (`HoldingsTab.tsx`) is the user's primary view for analyzing their active positions, identifying profit/loss, and understanding their cost basis. 

## 1. Overview of the Data Flow
The Holdings Statement is purely a rendering layer. It does not perform internal chronological looping; instead, it relies entirely on the final `AnalysisResult` exported by the Core Engine on the "present day".

```mermaid
flowchart LR
    A[Core Engine] -->|Exports Final Snapshot| B(Holdings Data)
    B --> C{Holdings Statement UI}
    C --> D[Summary Cards (Totals)]
    C --> E[Active Holdings Table]
    C --> F[Closed Positions Table]
```

## 2. Current Implementation: FIFO (First-In, First-Out)

In Part 2, the engine was successfully transitioned from an Average Cost model to a full FIFO accounting model to support accurate tax-based Realized Gains.
- **Buy Lots:** The engine tracks an array of individual purchases (`Buy Lot 1: 10 shares @ $50`, `Buy Lot 2: 5 shares @ $60`).
- **FIFO Selling:** When 12 shares are sold, the engine fully depletes `Buy Lot 1` (10 shares at $50) and partially depletes `Buy Lot 2` (2 shares at $60).
- **Realized Gains (FIFO):**
  ```text
  Realized Gain = (Proceeds from Sale) - (Cost of specific FIFO shares sold)
  ```

## 3. Mathematical Definitions for UI Columns

For every active stock in the portfolio, the table renders the following calculations based on the Engine's snapshot:

- **Qty (Shares Held):** The final net shares remaining after all chronological buys, sells, and splits.
- **Price:** The closing price of the stock on the very last day of the engine loop (or the closest interpolated day prior).
- **Value (Current Market Value):**
  ```text
  Value = Qty * Price
  ```
- **Cost (Total Invested Cost):** The remaining cost basis of the active shares (currently Average Cost, transitioning to the sum of remaining FIFO Buy Lots).
- **Unrealized Gain:** 
  ```text
  Unrealized Gain = Value - Cost
  ```
- **Realized Gain:** The accumulated profit from shares that have already been sold. (To be accurately surfaced in Part 2).

## 4. UI Layout & Aggregation

1. **Summary Metrics Cards:** Located at the top of the page.
   - **Total Portfolio Value:** Sum of `Value` for all active stocks + `$CASH`.
   - **Total Cost:** Sum of `Cost` for all active stocks.
   - **Unrealized Gain:** Sum of `Unrealized Gain` for all active stocks.
2. **Active Holdings:** The primary table showing stocks where `Qty > 0`.
3. **Closed Positions:** A secondary view (toggleable) for stocks where `Qty == 0` but `Realized Gain != 0`.
