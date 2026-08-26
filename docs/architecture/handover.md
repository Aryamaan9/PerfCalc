# Agent Handover Document

> **Last Updated:** 2026-08-26
> **Repo:** https://github.com/Aryamaan9/PerfCalc
> **Live App:** https://portfolio-alyzr-83921.web.app/advanced
> **Firebase Project:** portfolio-alyzr-83921

---

## Current State Summary

The application is a Portfolio Analyzer built with Next.js (static export) + Firebase Hosting + Firebase Cloud Functions + Firestore. It has two modes: a basic CSV upload mode and an Advanced Mode at /advanced. All recent work has been on Advanced Mode.

### What Was Just Completed

| Feature | Status |
|---|---|
| Part 1: Corporate Actions Refactor | DONE - Complete and Deployed |
| Part 2: FIFO Holdings Engine | DONE - Complete and Deployed |
| advancedDelete Cloud Function | DONE - Complete and Deployed |
| Permanent architecture docs in docs/architecture/ | DONE |
| HoldingsTab null-safe rendering | DONE |
| Playwright E2E test locator fixes | DONE |

### Latest Git Commits
- 14209b2 fix: null-safe rendering in HoldingsTab and fix E2E test locators
- 6354cca feat: Complete Part 1 and Part 2 FIFO implementation
- bb9d3db chore: configure routing for advancedDelete

---

## Architecture Overview

/advanced (Next.js page)
  AdvancedTabs.tsx            <- Sidebar tree (Family/Client/Portfolio) + tab router
    TransactionsTab.tsx       <- Add/edit/delete trades + CSV/XLSX upload
    TickersTab.tsx            <- Validate tickers via advancedValidateTickers
    CorporateActionsTab.tsx   <- Pending/Applied corporate actions (Action Center)
    HoldingsTab.tsx           <- FIFO holdings, realized/unrealized gains
    AnalyticsTab.tsx          <- Recharts time-series charts, KPI cards

### Cloud Functions (all deployed, us-central1)
- advancedList       : List all Families/Clients/Portfolios in Firestore
- advancedSave       : Save trades + actions for a portfolio
- advancedAnalyze    : Run computePortfolio() on saved data
- advancedAutoFetchActions : Hit Yahoo Finance for splits/dividends
- advancedValidateTickers  : Check that ticker symbols exist in Yahoo Finance
- advancedRawData    : Return raw stored trade/action data
- advancedRegroup    : Move portfolios between families/clients
- advancedDelete     : Delete families, clients, or portfolios

### Firestore Path Structure
advanced_workspaces/{familyId}/users/{userId}/brokers/{brokerId}
  -> { trades: Trade[], actions: CorporateAction[], updatedAt }

### Core Engine: src/lib/advancedEngine.ts
- FIFO BuyLot tracking - each buy creates a BuyLot { date, qty, totalCost }
- Sells drain the oldest lots first (true FIFO)
- Synthetic Trades for corporate actions (splits, dividends) are processed natively
- Returns AnalysisResult with dailyPortfolio, summary, tradeLog, symbolMap, reconciliationWarnings, auditAlerts

---

## NEXT TASK: Save Original Uploaded Files

### User Request
When a user uploads a CSV or XLSX file in the Transactions tab, save the original raw file to Firebase Storage so it can be retrieved or audited later.

### Proposed Implementation

#### 1. Firebase Storage Setup
- Enable Firebase Storage in Firebase Console for project portfolio-alyzr-83921
- Storage bucket path pattern: raw_uploads/{familyId}/{userId}/{brokerId}/{timestamp}_{filename}

#### 2. Modify advancedSave Cloud Function (functions/src/advancedEndpoints.ts)
- Change from JSON body to multipart/form-data
- Accept rawFile (bytes) and rawFileName fields
- Upload raw bytes to Firebase Storage before saving trades to Firestore
- Store the storage path in Firestore alongside the trades

#### 3. Modify TransactionsTab.tsx (src/components/advanced/tabs/TransactionsTab.tsx)
- Store the raw File object in state when a file is uploaded (currently only parsed trades are kept)
- On save (handleSave), send as multipart/form-data instead of JSON body:
  - tradesJson (stringified)
  - actionsJson (stringified)
  - rawFile (the actual file bytes)
  - rawFileName (original file name)

#### 4. (Optional) Show Upload History
- Small section in TransactionsTab listing previously uploaded files with download links from Firebase Storage

### Files to Touch
- functions/src/advancedEndpoints.ts   : Accept multipart, upload to Storage
- src/components/advanced/tabs/TransactionsTab.tsx : Send multipart with raw file
- firebase.json                         : Add storage rules if needed
- docs/architecture/                    : Document raw upload storage pattern

---

## Known Issues / Watch Out For

1. NO AUTHENTICATION - App has no user auth. All Firestore data is open. advancedDelete can be called by anyone with the familyId.
2. E2E test advanced-mode.spec.ts is partially flaky - A-Z flow test depends on Yahoo Finance not rate-limiting during test run.
3. HoldingsTab null crash - h.cost, h.price can be undefined when no price data exists for a date. Fixed with (h.cost || 0) guards.
4. Node.js 20 deprecation - Firebase warns EOL is Oct 2026. Needs upgrading to Node.js 22 before then.
5. firebase-functions SDK v4.5.0 - Should upgrade to >=5.1.0.

---

## How to Run Locally

cd portfolio-analyzer
npm install
npm run dev                # Next.js on localhost:3000

# Separate terminal for emulators:
cd functions
npm install
npx firebase emulators:start

## How to Build and Deploy

npm run build
npx firebase-tools deploy --only hosting
npx firebase-tools deploy --only functions

## Run Tests

npm run test:e2e           # Playwright E2E (requires npm run dev to be running)

---

## Docs Location

All permanent architecture docs are in:
docs/architecture/
  index.md                              <- Table of contents
  system_design.md                      <- Overall architecture
  core_engine_math.md                   <- advancedEngine.ts deep-dive
  part1_corporate_actions_walkthrough.md
  holdings_statement.md                 <- FIFO math & Holdings UI
  analytics_and_charts.md               <- Charts & KPIs
  handover.md                           <- THIS FILE
