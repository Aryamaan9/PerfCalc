# PerfCalc — Advanced Mode: Full Handoff Documentation

> **Branch:** `advanced-mode-refinement`  
> **Deployed at:** https://portfolio-alyzr-83921.web.app  
> **Firebase Project:** `portfolio-alyzr-83921`  
> **Repo:** https://github.com/Aryamaan9/PerfCalc  
> **Last Updated:** 2026-08-26

---

## 1. Project Overview

PerfCalc is a financial analytics platform for tracking portfolios across multiple brokers, clients, and families. It has two modes:

| Mode | URL | Purpose |
|---|---|---|
| **Base Mode** | `/` | Simple CSV upload → analyze flow (original, immutable) |
| **Advanced Mode** | `/advanced` | Multi-broker, multi-client, family-level portfolio management |

> ⚠️ **Critical Rule**: The base mode math engine (`src/lib/portfolioEngine.ts`) must never be touched. All new features are built as add-ons.

---

## 2. Architecture

```
PerfCalc/
├── src/
│   ├── app/
│   │   ├── page.tsx                    # Base mode (immutable)
│   │   ├── advanced/page.tsx           # Advanced mode entry
│   │   └── api/portfolio/              # Next.js API routes (local dev proxies)
│   │       ├── advancedList/route.ts
│   │       ├── advancedSave/route.ts
│   │       ├── advancedAnalyze/route.ts
│   │       ├── advancedRawData/route.ts
│   │       ├── advancedRegroup/route.ts
│   │       ├── advancedAutoFetch/route.ts
│   │       └── advancedValidate/route.ts
│   ├── components/advanced/
│   │   ├── AdvancedTabs.tsx            # ★ Main layout: mProfit-style sidebar + tabs
│   │   ├── ScopeManagerModal.tsx       # Move users/brokers between families
│   │   └── tabs/
│   │       ├── TransactionsTab.tsx     # Editable trade grid + search/sort
│   │       ├── TickersTab.tsx          # Ticker validation (auto-populated)
│   │       ├── CorporateActionsTab.tsx # Corp actions grid + auto-fetch
│   │       ├── HoldingsTab.tsx         # Date-specific holdings + audit
│   │       └── AnalyticsTab.tsx        # Charts/analytics
│   └── lib/
│       ├── portfolioEngine.ts          # ⚠️ IMMUTABLE — base math engine
│       └── advancedEngine.ts           # Advanced math engine (add-on)
├── functions/src/
│   ├── index.ts                        # ⚠️ IMMUTABLE — base Firebase functions
│   └── advancedEndpoints.ts            # All advanced Firebase functions
├── build-prod.js                       # ★ Production build script (see §5)
├── firebase.json                       # Hosting rewrites → Firebase functions
└── package.json
```

### Data Model (Firestore)
```
advanced_workspaces/
  {familyId}/
    users/
      {userId}/
        brokers/
          {brokerId}/
            tradesJson:   Trade[]          (JSON string)
            actionsJson:  CorporateAction[] (JSON string)
```

---

## 3. Firebase Functions (Backend)

All deployed to `us-central1`, accessible via Firebase Hosting rewrites:

| Function | Method | Route | Purpose |
|---|---|---|---|
| `advancedList` | GET | `/api/portfolio/advancedList` | Returns full Family→User→Broker tree |
| `advancedSave` | POST | `/api/portfolio/advancedSave` | Save trades/actions for a scope |
| `advancedAnalyze` | POST | `/api/portfolio/advancedAnalyze` | Run math engine, return holdings + audit |
| `advancedRawData` | POST | `/api/portfolio/advancedRawData` | Fetch raw unprocessed trades/actions |
| `advancedRegroup` | POST | `/api/portfolio/advancedRegroup` | Move User or Broker to different parent |
| `advancedAutoFetch` | POST | `/api/portfolio/advancedAutoFetch` | Fetch splits/dividends from Yahoo Finance |
| `advancedValidateTickers` | POST | `/api/portfolio/advancedValidate` | Validate ticker symbols via Yahoo Finance |

### advancedSave — Critical Logic
- `trades: undefined` → skip (don't overwrite existing trades)
- `trades: []` → explicitly zero out (user deleted all rows)
- Same logic for `actions`
- When saving at **User** scope (no brokerId), it aggregates by the `broker` column of each row and writes each broker separately

---

## 4. Frontend: Advanced Mode UI

### Layout (mProfit-style)
```
┌─────────────────┬─────────────────────────────────────────┐
│  PORTFOLIOS  ◀  │ 📁 Shah Family / 👤 Rahul  [Client]     │
├─────────────────┤──────────────────────────────────────────┤
│ ＋ New Family   │ TRANSACTIONS  TICKERS  CORP ACTIONS  ... │
│ ─────────────── ├──────────────────────────────────────────┤
│ ▼ 📁 Shah Fam 2 │                                          │
│   ▼ 👤 Rahul  1 │   [Tab content for selected scope]       │
│      🏦 Zerodha │                                          │
│      🏦 Groww   │                                          │
│      ＋ Add Port│                                          │
│   ＋ Add Client │                                          │
│ ▶ 📁 Trust    1 │                                          │
└─────────────────┴─────────────────────────────────────────┘
```

### Scope Selection Behaviour
- **Click 📁 Family** → aggregate view across all clients (userId = "")
- **Click 👤 Client** → that client's data across all portfolios (brokerId = "")
- **Click 🏦 Portfolio** → specific broker/account data
- Switching scopes with unsaved changes → confirmation prompt

### Tab: Transactions
- Editable data grid (Date, Symbol, Side, Qty, Price, Commission, Broker)
- Upload CSV/XLSX or add rows manually
- **Search** box: filters by Symbol or Side in real-time
- **Sortable columns**: click header to toggle asc/desc
- "Recalculate & Save" → runs engine + persists to Firestore

### Tab: Tickers
- Auto-populated with unique symbols from current transactions
- Validates each ticker against Yahoo Finance
- Shows ✅ Valid / ❌ Invalid badges

### Tab: Corporate Actions
- Upload CSV/XLSX or add rows manually
- "Auto-Fetch" button: pulls splits + dividends from Yahoo Finance for a symbol/date range
- Supports: DIVIDEND, SPLIT, BONUS, MERGER, DEMERGER, RIGHTS, DEPOSIT, WITHDRAWAL
- Status column: APPLIED / PENDING / IGNORED

### Tab: Holdings & Audit
- **Date Picker**: select any past date to see point-in-time holdings
- Holdings table: Symbol → Shares → Value
- Audit alerts: negative cash, negative holdings, price anomalies
- Reconciliation warnings

### Tab: Analytics
- Performance charts driven by the advanced engine's dailyPortfolio output

---

## 5. Build System

### The Problem
Next.js `output: "export"` (static export) is incompatible with dynamic API routes. The 7 proxy routes under `src/app/api/portfolio/advanced*` are needed for local `npm run dev` but break production builds.

### The Solution — `build-prod.js`
A custom build script that:
1. **Backs up** all 7 advanced proxy routes to a temp folder
2. **Deletes** them so Next.js sees a clean static project
3. Runs `next build`
4. **Restores** the proxy routes after build completes

```bash
npm run dev     # Uses proxy routes → calls production Firebase Functions
npm run build   # Runs build-prod.js → clean static export for Firebase Hosting
```

### Deploy Commands
```bash
# Frontend only
npm run build
npx firebase-tools deploy --only hosting

# Backend only (when advancedEndpoints.ts changes)
cd functions
npm run build
npx firebase-tools deploy --only functions

# Both
npm run build
npx firebase-tools deploy
```

---

## 6. Local Development Setup

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Run local dev server (proxies to production Firebase)
npm run dev
# → http://localhost:3000

# The proxy routes in src/app/api/portfolio/advanced*/route.ts
# forward all requests to https://portfolio-alyzr-83921.web.app/api/portfolio/*
```

> **Note:** Local dev hits the **production** Firebase database. If you want a local emulator, update the proxy routes to point to `http://127.0.0.1:5001/portfolio-alyzr-83921/us-central1/`.

---

## 7. Git Commit History

```
edb5fd3  feat: mProfit-style sidebar with Family/Client/Portfolio tree and inline Add modals
2ba01b7  fix: build pipeline for static export compatibility  
c939dcc  feat: complete advanced mode refinement phase 2
af4913f  feat: Add Advanced Mode module testing and UI overhaul
fe62369  Update README
fbb6f6e  Initial commit: Portfolio Analytics Platform
5326a1a  Initial commit
```

---

## 8. Changes Made in This Session (Phase 2)

### Backend (`functions/src/advancedEndpoints.ts`)
- **Fixed critical data-loss bug**: `advancedSave` with `merge: true` was wiping trades when called from Corporate Actions tab (which sent empty trades array). Fixed by treating `undefined` vs `[]` differently.
- **Fixed multi-broker deletion**: When saving at user scope and a broker's rows are all deleted, now explicitly sets that broker's array to `[]` in Firestore.
- **Added `advancedRegroup`**: Moves a User (with all their brokers) to a new family, or moves a Broker to a new user.
- **Added `advancedRawData`**: Returns unprocessed trades + actions for a given scope (used for auto-populate on scope switch).

### Frontend (`src/components/advanced/`)

#### `AdvancedTabs.tsx` — Complete Rewrite
- **mProfit-style sidebar** with collapsible Family → Client → Portfolio tree
- Inline **Add Family / Add Client / Add Portfolio** modals
- Scope selection by click (no more blank text inputs)
- Auto-expands tree to show current selection
- Gold highlight + left border on active item
- Count badges (# clients per family, # portfolios per client)
- Context breadcrumb bar in main panel
- Unsaved changes guard on scope switch
- Auto-fetches raw data (`advancedRawData`) on scope change

#### `TransactionsTab.tsx`
- Removed local state (uses lifted state from AdvancedTabs)
- Added real-time **search** by Symbol/Side
- Added **sortable column headers** (Date, Symbol, Side, Broker)

#### `CorporateActionsTab.tsx`
- Removed local state (uses lifted state)
- Fixed `handleEdit`/`handleDelete` to use index-based (not object reference)
- Save now correctly avoids wiping trades when only actions are saved

#### `HoldingsTab.tsx`
- Added **Snapshot Date Picker**
- Filters `dailyPortfolio` snapshots to the selected date (with fallback to nearest past date)
- Auto-sets date to latest available on first load

#### `TickersTab.tsx`
- Auto-populates input with unique symbols from `trades` prop on mount

#### `ScopeManagerModal.tsx` (NEW)
- Visual interface to move Users between Families, or Brokers between Users
- Calls `advancedRegroup` endpoint

### Build System
- **`build-prod.js`** (NEW): Handles incompatibility between Next.js static export and dynamic API proxy routes
- **`create_routes.js`** / **`patch_routes.js`**: Utility scripts for managing proxy routes
- Updated `package.json` `build` script to use `build-prod.js`
- Created 7 Next.js proxy routes (`src/app/api/portfolio/advanced*/route.ts`)

---

## 9. Known Limitations / Future Work

| Item | Notes |
|---|---|
| Local dev hits production DB | Update proxy `route.ts` files to point to emulator if needed |
| `advancedList` returns `_init` placeholders | Filter these out in UI (already done for brokers/users with id `_init`) |
| No auth | Anyone with the URL can read/write all data |
| Aggregated analytics | Analytics tab at Family/User level shows only first broker's data currently |
| No delete Family/Client/Portfolio | Deletion UI not yet built |

---

## 10. Environment / Credentials

| Item | Value |
|---|---|
| Firebase Project ID | `portfolio-alyzr-83921` |
| Hosting URL | https://portfolio-alyzr-83921.web.app |
| Firestore collection | `advanced_workspaces` |
| Node version | 20 (Firebase functions) / 24 (local) |
| Next.js version | 16.2.9 |
| React version | 19.2.4 |
