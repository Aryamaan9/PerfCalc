# Portfolio Analyzer Documentation Hub

Welcome to the internal documentation for the Portfolio Analyzer architecture. This directory serves as the permanent, version-controlled source of truth for all mathematical models, chronological engine loops, and data pipelines within the application.

### Table of Contents

1. [**System Design Overview**](./system_design.md)
   - The overarching architecture of the application, including the transition to Synthetic Trades for Corporate Actions and FIFO accounting for Holdings.

2. [**Core Engine Mathematics**](./core_engine_math.md)
   - Deep dive into `advancedEngine.ts`.
   - The chronological day-by-day looping logic.
   - Exact mathematical formulas for Cash Balances, Share Balances, and Price Interpolation (weekend gap filling).

3. [**Corporate Actions Walkthrough**](./part1_corporate_actions_walkthrough.md)
   - Flowchart of the Action Center.
   - The math behind generating Synthetic Trades for Dividends and Stock Splits.
   - Safety locks and tightly coupled deletion mechanisms.

4. [**Holdings Statement & FIFO Strategy**](./holdings_statement.md)
   - Data flow from Engine -> UI.
   - Current Average Cost logic vs. the upcoming First-In-First-Out (FIFO) logic.
   - Mathematical definitions for Current Value, Unrealized Gain, and Realized Gain calculations.

5. [**Analytics & Charts**](./analytics_and_charts.md)
   - Breakdown of the `DailyPortfolioEntry` time-series data structure.
   - Chart rendering logic via Recharts.
   - Formulas for Key Performance Indicators (KPIs) like Holding Return and Peak Value.

> *Note: These documents should be updated immediately alongside any major mathematical or structural changes to the codebase.*
