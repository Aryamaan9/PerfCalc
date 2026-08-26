import { test, expect } from "@playwright/test";
import { uploadDataset, assertCardValue } from "./helpers";

test.describe("01 - Baseline Portfolio Dataset E2E", () => {
  test("Uploads Baseline CSV dataset and verifies mathematical accuracy and UI tabs", async ({ page }) => {
    await uploadDataset(page, "01_baseline", { useXlsx: false });

    // 1. Assert Overview Summary Cards against hand-calculated values
    // Current Portfolio Value: ₹3,60,000 (INFY 70*1700=119k + TCS 50*3500=175k + HDFC 40*1650=66k)
    await assertCardValue(page, "Current Portfolio Value", /₹\s*3,?60,?000/);

    // Total Invested (Cost Basis): ₹3,29,000 (INFY 105k + TCS 160k + HDFC 64k)
    await assertCardValue(page, "Total Invested", /₹\s*3,?29,?000/);

    // Holding Return: +9.42%
    await assertCardValue(page, "Holding Return", /\+?9\.42%/);

    // Peak Portfolio Value: ₹3,60,000
    await assertCardValue(page, "Peak Portfolio Value", /₹\s*3,?60,?000/);

    // Total Dividends: ₹0
    await assertCardValue(page, "Total Dividends", /₹\s*0/);

    // Stocks in Portfolio: 3
    await assertCardValue(page, "Stocks in Portfolio", "3");

    // Assert Date Range in header
    await expect(page.locator(".header-date")).toContainText("2023");

    // 2. Test Chart vs Table toggle on Overview Tab
    const tableToggleBtn = page.getByRole("button", { name: /TABLE/i });
    await tableToggleBtn.click();
    await expect(page.locator(".table-wrap table")).toBeVisible();
    await expect(page.locator(".table-wrap table thead")).toContainText("Portfolio Value");

    const chartToggleBtn = page.getByRole("button", { name: /CHART/i });
    await chartToggleBtn.click();
    await expect(page.locator(".chart-wrap canvas").first()).toBeVisible();

    // 3. Test Holdings Tab
    const holdingsTabBtn = page.getByRole("button", { name: /Holdings/i });
    await holdingsTabBtn.click();
    await expect(page.locator(".chart-title").filter({ hasText: /Holdings Breakdown Over Time/i })).toBeVisible();

    // Check individual stock selector contains INFY, TCS, HDFCBANK
    const stockSelect = page.locator(".select-control").first();
    await expect(stockSelect).toBeVisible();
    await stockSelect.selectOption({ label: "TCS" });
    await expect(page.locator(".chart-title").filter({ hasText: /Individual Stock Performance/i })).toBeVisible();

    // 4. Test Corporate Actions Tab (should be empty for baseline)
    const corpTabBtn = page.getByRole("button", { name: /Corporate Actions/i });
    await corpTabBtn.click();
    await expect(page.locator("text=No corporate actions found")).toBeVisible();

    // 5. Test Trade Ledger Tab
    const tradesTabBtn = page.getByRole("button", { name: /Trade Ledger/i });
    await tradesTabBtn.click();
    const tradeRows = page.locator(".data-table tbody tr");
    await expect(tradeRows).toHaveCount(4);

    // Verify filter by side
    const sideFilter = page.locator(".select-control").first();
    await sideFilter.selectOption("Sell");
    await expect(page.locator(".data-table tbody tr")).toHaveCount(1);
    await expect(page.locator(".data-table tbody")).toContainText("INFY.NS");

    // Reset filter
    await sideFilter.selectOption("all");
    await expect(page.locator(".data-table tbody tr")).toHaveCount(4);
  });

  test("Uploads Baseline XLSX dataset and verifies equivalent calculation", async ({ page }) => {
    await uploadDataset(page, "01_baseline", { useXlsx: true });

    await assertCardValue(page, "Current Portfolio Value", /₹\s*3,?60,?000/);
    await assertCardValue(page, "Total Invested", /₹\s*3,?29,?000/);
    await assertCardValue(page, "Holding Return", /\+?9\.42%/);
    await assertCardValue(page, "Stocks in Portfolio", "3");
  });
});
