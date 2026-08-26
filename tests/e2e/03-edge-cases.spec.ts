import { test, expect } from "@playwright/test";
import { uploadDataset, assertCardValue } from "./helpers";

test.describe("03 - Edge Cases & Robustness E2E", () => {
  test("Handles multiple date formats, symbol normalizations, complete liquidations, and price interpolations", async ({ page }) => {
    await uploadDataset(page, "03_edge_cases", { useXlsx: false });

    // 1. Assert Overview Summary Cards
    // Current Portfolio Value: ₹46,800 (ITC 120 shares @ ₹390; WIPRO fully liquidated)
    await assertCardValue(page, "Current Portfolio Value", /₹\s*46,?800/);

    // Total Invested (Cost Basis): ₹42,605 (ITC cost basis: 35000 + 7605; WIPRO cost basis reset to 0 upon liquidation)
    await assertCardValue(page, "Total Invested", /₹\s*42,?605/);

    // Holding Return: +9.85% ((46800 - 42605) / 42605 * 100)
    await assertCardValue(page, "Holding Return", /\+?9\.85%/);

    // Unique Stocks Traded in Portfolio: 2 (WIPRO and ITC)
    await assertCardValue(page, "Stocks in Portfolio", "2");

    // 2. Assert Missing Price Dates warning strip is displayed (weighted average interpolation)
    const missingPriceWarning = page.locator(".warning-strip").filter({ hasText: /missing price entries/i });
    await expect(missingPriceWarning).toBeVisible();
    await expect(missingPriceWarning).toContainText("interpolated");

    // 3. Check Trade Ledger symbol normalization & pagination
    const tradesTabBtn = page.getByRole("button", { name: /Trade Ledger/i });
    await tradesTabBtn.click();

    // Verify 4 trades rendered
    const rows = page.locator(".data-table tbody tr");
    await expect(rows).toHaveCount(4);

    // Check ticker normalization mapping shown in UI (e.g. NSE:WIPRO → WIPRO.NS)
    await expect(page.locator(".data-table")).toContainText("NSE:WIPRO");
    await expect(page.locator(".data-table")).toContainText("WIPRO.NS");
    await expect(page.locator(".data-table")).toContainText("ITC.NS");

    // Check commissions are displayed in the trade ledger
    await expect(page.locator(".data-table")).toContainText("₹15.50");
    await expect(page.locator(".data-table")).toContainText("₹10.00");
  });

  test("Handles Edge Cases XLSX dataset properly", async ({ page }) => {
    await uploadDataset(page, "03_edge_cases", { useXlsx: true });

    await assertCardValue(page, "Current Portfolio Value", /₹\s*46,?800/);
    await assertCardValue(page, "Total Invested", /₹\s*42,?605/);
    await assertCardValue(page, "Holding Return", /\+?9\.85%/);
  });
});
