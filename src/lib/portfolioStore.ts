import { Trade, CorporateAction } from "./portfolioEngine";

export interface StoredPortfolio {
  id: string;
  trades: Trade[];
  actions: CorporateAction[];
  updatedAt: Date;
}

// Global in-memory store for Next.js development server
declare global {
  var __portfolioStore: Map<string, StoredPortfolio> | undefined;
}

if (!global.__portfolioStore) {
  global.__portfolioStore = new Map<string, StoredPortfolio>();
}

export const portfolioStore = global.__portfolioStore;
