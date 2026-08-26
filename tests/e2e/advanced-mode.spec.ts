import { test, expect } from '@playwright/test';

test.describe('Advanced Mode Full Flow', () => {
  test('A-Z User Flow', async ({ page }) => {
    // 1. Navigate to advanced mode
    await page.goto('/advanced');
    await expect(page.locator('h1')).toContainText('ADVANCED');
    
    // 2. Select scope
    await page.selectOption('select', 'defaultFamily');
    await page.fill('input[placeholder*="User ID"]', 'PlaywrightUser');
    await page.fill('input[placeholder*="Broker ID"]', 'PlaywrightBroker');
    
    // 3. Go to Transactions
    await page.click('text="Transactions"');
    await page.click('text="➕ Add Row"');
    
    // Fill the new row
    await page.fill('tbody tr:first-child td:nth-child(2) input', 'AAPL');
    await page.selectOption('tbody tr:first-child td:nth-child(3) select', 'Buy');
    await page.fill('tbody tr:first-child td:nth-child(4) input', '10'); // Qty
    await page.fill('tbody tr:first-child td:nth-child(5) input', '150'); // Price
    
    // 4. Save
    page.on('dialog', dialog => dialog.accept());
    await page.click('text="Recalculate & Save"');
    await page.waitForTimeout(2000); // wait for save
    
    // 5. Tickers Tab (Auto-population)
    await page.click('text="Tickers"');
    await expect(page.locator('input[placeholder*="AAPL"]')).toHaveValue('AAPL');
    await page.click('text="Validate"');
    await expect(page.locator('text="✅ Valid"')).toBeVisible({ timeout: 10000 });
    
    // 6. Corporate Actions
    await page.click('text="Corporate Actions"');
    await page.click('text="➕ Add Row"');
    await page.fill('tbody tr:first-child td:nth-child(2) input', 'AAPL');
    await page.selectOption('tbody tr:first-child td:nth-child(3) select', 'DIVIDEND');
    await page.fill('tbody tr:first-child td:nth-child(4) input', '1.5'); // Value
    await page.click('button:has-text("Save Actions")');
    await page.waitForTimeout(2000); // wait for save
    
    // 7. Holdings & Audit
    await page.click('text="Holdings & Audit"');
    await page.click('button:has-text("Refresh Audit")');
    
    await expect(page.locator('text="Current Holdings"').or(page.locator('text="Holdings as of"'))).toBeVisible({ timeout: 15000 });
    
    // Check that AAPL is in the holdings
    await expect(page.locator('td', { hasText: 'AAPL' })).toBeVisible();
    await expect(page.locator('td', { hasText: '10.00' })).toBeVisible();
    
    // 8. Test search and sort in Transactions
    await page.click('text="Transactions"');
    await page.fill('input[placeholder*="Search symbol"]', 'AAPL');
    await expect(page.locator('td', { hasText: 'AAPL' })).toBeVisible();
    
    // 9. Scope Manager
    await page.click('text="⚙️ Manage Scopes"');
    await expect(page.locator('text="Move What?"')).toBeVisible();
    await page.click('button:has-text("Cancel")');
    
    console.log("Full A-Z test completed successfully!");
  });
});
