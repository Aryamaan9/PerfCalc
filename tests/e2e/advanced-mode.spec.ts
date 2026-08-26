import { test, expect } from '@playwright/test';

test.describe('Advanced Mode Full Flow', () => {
  test('A-Z User Flow', async ({ page }) => {
    await page.goto('/advanced');
    await expect(page.locator('h1')).toContainText('ADVANCED');
    
    await page.click('text=/New Family/i');
    await page.fill('input[placeholder="Family name"]', 'TestFamily');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500);

    await page.click('text=/TestFamily/i');
    await page.click('text=/Add Client/i');
    await page.fill('input[placeholder="Client name"]', 'TestClient');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500);

    await page.click('text=/TestClient/i');
    await page.click('text=/Add Portfolio/i');
    await page.fill('input[placeholder*="Broker name"]', 'TestBroker');
    await page.click('button:has-text("Create")');
    await page.waitForTimeout(500);

    await page.click('text=/TestBroker/i');    
    
    await page.click('text="Transactions"');
    await page.click('text=/Add Row/i');
    
    await page.fill('tbody tr:first-child td:nth-child(2) input', 'AAPL');
    await page.selectOption('tbody tr:first-child td:nth-child(3) select', 'Buy');
    await page.fill('tbody tr:first-child td:nth-child(4) input', '10');
    await page.fill('tbody tr:first-child td:nth-child(5) input', '150');
    
    page.on('dialog', dialog => dialog.accept());
    await page.click('text="Recalculate & Save"');
    await expect(page.locator('button:has-text("Recalculate & Save")')).not.toBeDisabled({ timeout: 15000 });
    
    await page.click('text="Tickers"');
    await expect(page.locator('input[placeholder*="AAPL"]')).toHaveValue(/AAPL/);
    // Skipping exact validation text to avoid flakiness with Yahoo Finance rate limits
    await page.click('text="Validate"');
    
    await page.click('text="Corporate Actions"');
    await expect(page.locator('text="Action Center"')).toBeVisible();
    
    await page.click('text=/Holdings/i');
    await page.click('button:has-text("Refresh Report")');
    
    await expect(page.locator('text="Active Holdings"')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('td', { hasText: 'AAPL' }).first()).toBeVisible();
    await expect(page.locator('text="Total Portfolio Value"')).toBeVisible();
    
    await page.click('text="Transactions"');
    await page.fill('input[placeholder*="Search symbol"]', 'AAPL');
    await expect(page.locator('td', { hasText: 'AAPL' }).first()).toBeVisible();
    
    await page.click('text=/Manage Scopes/i');
    await expect(page.locator('text="Move What?"')).toBeVisible();
    await page.click('button:has-text("Cancel")');
  });
});
