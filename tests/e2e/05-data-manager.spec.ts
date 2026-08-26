import { test, expect } from "@playwright/test";
import path from "path";

test.describe("05 - Database Manager & Navigation UI E2E", () => {
  test("Navigates, saves portfolio to database, lists it, and executes database analysis", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator(".brand-name")).toBeVisible();

    // 1. Click Open Database Manager
    const dbManagerBtn = page.getByRole("button", { name: /Open Database Manager/i });
    await expect(dbManagerBtn).toBeVisible();
    await dbManagerBtn.click();

    // 2. Assert Data Manager section is visible
    await expect(page.locator("h2")).toContainText("Firestore Data Manager");
    await expect(page.locator("h3", { hasText: "Create New Portfolio" })).toBeVisible();
    await expect(page.locator("h3", { hasText: "Saved Portfolios" })).toBeVisible();

    // 3. Check form elements and create new portfolio
    const nameInput = page.getByPlaceholder(/Portfolio Name/i);
    await expect(nameInput).toBeVisible();
    await nameInput.fill("Alpha Growth Fund");

    const tradesPath = path.resolve(__dirname, "..", "fixtures", "01_baseline", "trades.csv");
    const fileInputs = page.locator('input[type="file"]');
    await fileInputs.first().setInputFiles(tradesPath);

    const saveBtn = page.getByRole("button", { name: /Save to Database/i });
    await expect(saveBtn).toBeEnabled();
    await saveBtn.click();

    // 4. Verify portfolio is listed in Saved Portfolios
    await expect(page.locator("ul")).toContainText("Alpha Growth Fund");

    // 5. Analyze portfolio from database
    const analyzeBtn = page.locator("li").filter({ hasText: "Alpha Growth Fund" }).getByRole("button", { name: /Analyze/i });
    await expect(analyzeBtn).toBeVisible();
    await analyzeBtn.click();

    // 6. Assert dashboard loads from DB analysis
    await expect(page.locator(".summary-grid")).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".card-label", { hasText: "Stocks in Portfolio" })).toBeVisible();

    // 7. Test Template bar links
    await expect(page.locator(".template-bar")).toBeVisible();
    const templateLinks = page.locator(".template-btn");
    await expect(templateLinks.first()).toBeVisible();
  });
});
