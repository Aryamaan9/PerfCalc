import { test, expect } from "@playwright/test";
import { uploadDataset } from "./helpers";

test.describe("04 - High-Volume Stress Test E2E", () => {
  test("Successfully processes high-volume dataset across 20 tickers and 2-year timeline", async ({ page }) => {
    // Increase test timeout for large dataset computation
    test.setTimeout(60000);

    await uploadDataset(page, "04_stress_test", { useXlsx: false });

    // 1. Assert Overview Summary Cards are populated
    const card = page.locator(".summary-card").filter({ has: page.locator(".card-label", { hasText: "Stocks in Portfolio" }) });
    await expect(card).toBeVisible();
    await expect(card.locator(".card-value")).toHaveText("20");

    // Total Dividends received across corporate actions
    await expect(page.locator(".summary-card").filter({ hasText: /Total Dividends/i })).toBeVisible();

    // Verify Peak Value is positive
    const peakCard = page.locator(".summary-card").filter({ hasText: /Peak Portfolio Value/i });
    await expect(peakCard).toBeVisible();
    await expect(peakCard.locator(".card-value")).not.toHaveText("₹0");

    // 2. Test Trade Ledger Pagination (with 60+ trades, page size is 30)
    const tradesTabBtn = page.getByRole("button", { name: /Trade Ledger/i });
    await tradesTabBtn.click();

    // Verify first page renders 30 trades
    const rows = page.locator(".data-table tbody tr");
    await expect(rows).toHaveCount(30);

    // Verify pagination controls exist
    const nextBtn = page.getByRole("button", { name: /Next →/i });
    await expect(nextBtn).toBeVisible();
    await nextBtn.click();

    // Page 2 should have remaining 20 trades (50 total trades - 30 on page 1)
    const page2Rows = page.locator(".data-table tbody tr");
    await expect(page2Rows).toHaveCount(20);

    // Filter by specific symbol (e.g. SBIN.NS - 3 trades: Jan 2022 buy, Oct 2022 buy, May 2023 sell)
    const symFilter = page.locator(".select-control").nth(1);
    await symFilter.selectOption("SBIN.NS");
    await expect(page.locator(".data-table tbody tr")).toHaveCount(3);

    // 3. Test Download Report (Excel) button
    const overviewTabBtn = page.getByRole("button", { name: /Overview/i });
    await overviewTabBtn.click();

    const downloadPromise = page.waitForEvent("download");
    const downloadBtn = page.getByRole("button", { name: /DOWNLOAD REPORT \(EXCEL\)/i });
    await downloadBtn.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toContain("portfolio_analysis_report_");
  });
});
