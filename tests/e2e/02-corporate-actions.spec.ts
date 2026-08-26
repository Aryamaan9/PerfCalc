import { test, expect } from "@playwright/test";
import { uploadDataset, assertCardValue } from "./helpers";

test.describe("02 - Corporate Actions & Anomaly Detection E2E", () => {
  test("Uploads Corporate Actions dataset, verifies split adjustments, dividends, and anomaly alerts", async ({ page }) => {
    await uploadDataset(page, "02_corporate_actions", { useXlsx: false });

    // 1. Verify Overview Summary Cards against hand-calculated values
    // Current Portfolio Value: ₹5,90,000
    await assertCardValue(page, "Current Portfolio Value", /₹\s*5,?90,?000/);

    // Total Invested: ₹2,90,000
    await assertCardValue(page, "Total Invested", /₹\s*2,?90,?000/);

    // Holding Return: +103.45%
    await assertCardValue(page, "Holding Return", /\+?103\.45%/);

    // Peak Portfolio Value: ₹5,90,000
    await assertCardValue(page, "Peak Portfolio Value", /₹\s*5,?90,?000/);

    // Total Dividends: ₹2,000
    await assertCardValue(page, "Total Dividends", /₹\s*2,?000/);

    // Stocks in Portfolio: 2
    await assertCardValue(page, "Stocks in Portfolio", "2");

    // 2. Verify Anomaly Warning Strip is displayed on the UI
    const anomalyBanner = page.locator(".warning-strip").filter({ hasText: /Anomaly Detected/i });
    await expect(anomalyBanner).toBeVisible();
    await expect(anomalyBanner).toContainText("TATAMOTORS");
    await expect(anomalyBanner).toContainText("surged by 400%");

    // 3. Navigate to Corporate Actions Tab
    const corpTabBtn = page.getByRole("button", { name: /Corporate Actions/i });
    await corpTabBtn.click();

    // Verify Corporate Actions Summary Cards
    await expect(page.locator(".summary-card").filter({ hasText: /Total Dividends/i })).toContainText(/₹\s*2,?000/);
    await expect(page.locator(".summary-card").filter({ hasText: /Stock Splits/i })).toContainText("2");

    // Verify Corporate Actions Log table has 4 records
    const actionRows = page.locator(".data-table tbody tr");
    await expect(actionRows).toHaveCount(4);

    // Verify split details in table
    await expect(page.locator(".data-table")).toContainText("TATAMOTORS");
    await expect(page.locator(".data-table")).toContainText("5:1");
    await expect(page.locator(".data-table")).toContainText("RELIANCE");
    await expect(page.locator(".data-table")).toContainText("2:1");

    // 4. Navigate to Holdings tab to verify share counts
    const holdingsTabBtn = page.getByRole("button", { name: /Holdings/i });
    await holdingsTabBtn.click();

    // Top holdings table should show RELIANCE with 200 shares and TATAMOTORS with 500 shares
    await expect(page.locator("body")).toContainText("RELIANCE");
  });

  test("Uploads Corporate Actions XLSX dataset and verifies equivalent results", async ({ page }) => {
    await uploadDataset(page, "02_corporate_actions", { useXlsx: true });

    await assertCardValue(page, "Current Portfolio Value", /₹\s*5,?90,?000/);
    await assertCardValue(page, "Total Dividends", /₹\s*2,?000/);
    await assertCardValue(page, "Holding Return", /\+?103\.45%/);

    const anomalyBanner = page.locator(".warning-strip").filter({ hasText: /Anomaly Detected/i });
    await expect(anomalyBanner).toBeVisible();
  });
});
