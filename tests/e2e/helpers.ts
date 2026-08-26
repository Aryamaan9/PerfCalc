import { Page, expect, Locator } from "@playwright/test";
import path from "path";

export interface UploadOptions {
  useXlsx?: boolean;
  includePrices?: boolean;
  includeActions?: boolean;
}

export async function uploadDataset(
  page: Page,
  fixtureFolder: string,
  options: UploadOptions = {}
) {
  const ext = options.useXlsx ? "xlsx" : "csv";
  const tradesPath = path.resolve(__dirname, "..", "fixtures", fixtureFolder, `trades.${ext}`);
  const pricesPath = path.resolve(__dirname, "..", "fixtures", fixtureFolder, `prices.${ext}`);
  const actionsPath = path.resolve(__dirname, "..", "fixtures", fixtureFolder, `actions.${ext}`);

  await page.goto("/");
  await expect(page.locator(".brand-name")).toBeVisible();

  // Upload Trades
  const tradesZone = page.locator(".upload-zone").filter({ hasText: "Trades Statement" });
  await tradesZone.locator('input[type="file"]').setInputFiles(tradesPath);
  await expect(tradesZone.locator(".file-name")).toBeVisible();

  // Upload Prices if requested (default true)
  if (options.includePrices !== false) {
    const pricesZone = page.locator(".upload-zone").filter({ hasText: "Historic Prices" });
    await pricesZone.locator('input[type="file"]').setInputFiles(pricesPath);
    await expect(pricesZone.locator(".file-name")).toBeVisible();
  }

  // Upload Actions if requested (default true)
  if (options.includeActions !== false) {
    const actionsZone = page.locator(".upload-zone").filter({ hasText: "Corporate Actions" });
    await actionsZone.locator('input[type="file"]').setInputFiles(actionsPath);
    await expect(actionsZone.locator(".file-name")).toBeVisible();
  }

  // Click Analyze
  const analyzeBtn = page.getByRole("button", { name: /Analyse Portfolio/i });
  await expect(analyzeBtn).toBeEnabled();
  await analyzeBtn.click();

  // Wait for loading to finish and summary cards to be visible
  await expect(page.locator(".summary-grid")).toBeVisible({ timeout: 30000 });
}

export function getSummaryCard(page: Page, label: string): Locator {
  return page.locator(".summary-card").filter({ has: page.locator(".card-label", { hasText: label }) });
}

export async function assertCardValue(page: Page, label: string, expectedValue: string | RegExp) {
  const card = getSummaryCard(page, label);
  await expect(card).toBeVisible();
  const valueLocator = card.locator(".card-value");
  if (typeof expectedValue === "string") {
    await expect(valueLocator).toHaveText(expectedValue);
  } else {
    await expect(valueLocator).toHaveText(expectedValue);
  }
}
