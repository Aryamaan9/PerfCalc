# PerfCalc — Portfolio Analytics & Performance Engine

A high-precision portfolio simulation and reconciliation engine built with Next.js, TypeScript, and Firebase.

## Features
- **Stateless & Database Analytics**: Upload trades/corporate actions CSV/XLSX or save portfolios to Firestore.
- **Precision Simulation Engine**: Handles complex corporate actions (splits, bonuses, dividends) with time-travel adjustments.
- **Day-over-Day Anomaly Detection**: Proactively flags abnormal day-over-day portfolio fluctuations and missing price data.
- **End-to-End Test Suite**: Comprehensive Playwright test coverage verifying mathematical accuracy against hand-calculated ground truths.

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Running Tests

```bash
npm run test:e2e
```
