import { test, expect } from '@playwright/test';

test.describe('Advanced Mode Full Flow', () => {
  test.setTimeout(30000); // 30 seconds per test

  test('A-Z User Flow', async ({ page }) => {
    await page.goto('/advanced');

    await expect(page.locator('button:has-text("＋ New Family")')).toBeVisible();

    const uniqueFamily = `TestFam_${Date.now()}`;
    await page.getByRole('button', { name: '＋ New Family', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New Family' })).toBeVisible();
    await page.fill('input[placeholder="Family name"]', uniqueFamily);
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    const famBtn = page.locator('button', { hasText: uniqueFamily }).first();
    await expect(famBtn).toBeVisible({ timeout: 10000 });
    await famBtn.click();

    await page.getByRole('button', { name: '＋ Add Client', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New Client' })).toBeVisible();
    await page.fill('input[placeholder="Client name"]', 'TestClient');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    const clientBtn = page.locator('button', { hasText: 'TestClient' }).first();
    await expect(clientBtn).toBeVisible();
    await clientBtn.click();

    await page.getByRole('button', { name: '＋ Add Portfolio', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'New Portfolio' })).toBeVisible();
    await page.fill('input[placeholder="Portfolio / Broker name"]', 'TestBroker');
    await page.getByRole('button', { name: 'Create', exact: true }).click();

    const brokerBtn = page.locator('button', { hasText: 'TestBroker' }).first();
    await expect(brokerBtn).toBeVisible();
    await brokerBtn.click();

    await page.click('button:has-text("Tickers")');
    await page.fill('input[placeholder*="AAPL"]', 'AAPL');
    await page.click('button:has-text("Validate")');
    await expect(page.locator('text="✅ Valid"').or(page.locator('text="❌ Invalid"'))).toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Transactions")');
    await page.click('button:has-text("Add Row")');
    await page.fill('tbody tr:last-child td:nth-child(1) input', '2024-01-15');
    await page.fill('tbody tr:last-child td:nth-child(2) input', 'AAPL');
    await page.selectOption('tbody tr:last-child td:nth-child(3) select', 'Buy');
    await page.fill('tbody tr:last-child td:nth-child(4) input', '50');
    await page.fill('tbody tr:last-child td:nth-child(5) input', '150');
    
    page.on('dialog', dialog => dialog.accept());
    await page.click('text="Recalculate & Save"');
    await expect(page.locator('text="● Unsaved changes"')).not.toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Corporate Actions")');
    await page.click('button:has-text("Add Row")');
    await page.fill('tbody tr:last-child td:nth-child(1) input', '2024-06-01');
    await page.fill('tbody tr:last-child td:nth-child(2) input', 'AAPL');
    await page.selectOption('tbody tr:last-child td:nth-child(3) select', 'DIVIDEND');
    await page.fill('tbody tr:last-child td:nth-child(4) input', '1.5');
    await page.click('button:has-text("Save Actions")');
    await expect(page.locator('text="● Unsaved changes"')).not.toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Holdings & Audit")');
    await expect(page.locator('button:has-text("Refresh Audit")')).toBeVisible({ timeout: 15000 });
    const row = page.locator('tr', { hasText: 'AAPL' }).first();
    await expect(row.locator('td').nth(1)).toHaveText('50.00', { timeout: 15000 });

    // 6. Test Analytics Render
    await page.click('button:has-text("Analytics")');
    await expect(page.locator('canvas').first()).toBeVisible({ timeout: 15000 });

    // 7. Verify Unsaved warning works by changing scope
    await page.click('button:has-text("Transactions")');
    await page.click('button:has-text("Add Row")');
    await expect(page.locator('text="● Unsaved changes"')).toBeVisible();

    // 8. Scope Manager tests
    await page.click('button:has-text("Manage Scopes")');
    await expect(page.locator('h2', { hasText: /Scope/i })).toBeVisible();
    await page.click('button:has-text("Cancel")');
  });

  test('Unsaved Changes Warning on Scope Switch', async ({ page }) => {
    await page.goto('/advanced');
    
    const tempFam = `WarnFam_${Date.now()}`;
    await page.getByRole('button', { name: '＋ New Family', exact: true }).click();
    await page.fill('input[placeholder="Family name"]', tempFam);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    
    const famBtn = page.locator('button', { hasText: tempFam }).first();
    await expect(famBtn).toBeVisible({ timeout: 10000 });
    await famBtn.click();

    await page.click('button:has-text("Transactions")');
    await page.click('button:has-text("Add Row")');
    await page.fill('tbody tr:first-child td:nth-child(2) input', 'TSLA');
    
    await expect(page.locator('text="● Unsaved changes"')).toBeVisible();

    page.on('dialog', async dialog => {
      await dialog.dismiss();
    });

    await page.getByRole('button', { name: '＋ New Family', exact: true }).click();
    await page.fill('input[placeholder="Family name"]', 'AnotherFam');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    
    const anotherFamBtn = page.locator('button', { hasText: 'AnotherFam' }).first();
    await expect(anotherFamBtn).toBeVisible({ timeout: 10000 });
    await anotherFamBtn.click(); // this triggers the dialog
    
    await expect(page.locator('button', { hasText: tempFam }).first()).toBeVisible();
  });

  test('Holdings Date Picker and Corporate Action Impact', async ({ page }) => {
    await page.goto('/advanced');
    
    const fam = `HoldFam_${Date.now()}`;
    await page.getByRole('button', { name: '＋ New Family', exact: true }).click();
    await page.fill('input[placeholder="Family name"]', fam);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    
    const famBtn = page.locator('button', { hasText: fam }).first();
    await expect(famBtn).toBeVisible({ timeout: 10000 });
    await famBtn.click();

    await page.getByRole('button', { name: '＋ Add Client', exact: true }).click();
    await page.fill('input[placeholder="Client name"]', 'ClientA');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    
    const clientBtn = page.locator('button', { hasText: 'ClientA' }).first();
    await expect(clientBtn).toBeVisible();
    await clientBtn.click();

    await page.getByRole('button', { name: '＋ Add Portfolio', exact: true }).click();
    await page.fill('input[placeholder="Portfolio / Broker name"]', 'PortA');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    
    const brokerBtn = page.locator('button', { hasText: 'PortA' }).first();
    await expect(brokerBtn).toBeVisible();
    await brokerBtn.click();

    await page.click('button:has-text("Transactions")');
    await page.click('button:has-text("Add Row")');
    await page.fill('tbody tr:last-child td:nth-child(1) input', '2024-01-10');
    await page.fill('tbody tr:last-child td:nth-child(2) input', 'TSLA');
    await page.selectOption('tbody tr:last-child td:nth-child(3) select', 'Buy');
    await page.fill('tbody tr:last-child td:nth-child(4) input', '10');
    await page.fill('tbody tr:last-child td:nth-child(5) input', '200');
    
    page.on('dialog', dialog => dialog.accept());
    await page.click('text="Recalculate & Save"');
    await expect(page.locator('text="● Unsaved changes"')).not.toBeVisible();

    await page.click('button:has-text("Holdings & Audit")');
    const dateInput = page.locator('input[type="date"]');
    await expect(dateInput).toBeVisible({ timeout: 15000 });
    
    // Just change date, it auto-updates the table
    await dateInput.fill('2024-02-01');
    await dateInput.press('Enter');
    
    await expect(page.locator('text="Holdings as of 2024-02-01"')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('td', { hasText: 'TSLA' }).first()).toBeVisible();
    await expect(page.locator('td', { hasText: '10.00' }).first()).toBeVisible();

    await page.click('button:has-text("Corporate Actions")');
    await page.click('button:has-text("Add Row")');
    await page.fill('tbody tr:last-child td:nth-child(1) input', '2024-03-10');
    await page.fill('tbody tr:last-child td:nth-child(2) input', 'TSLA');
    await page.selectOption('tbody tr:last-child td:nth-child(3) select', 'SPLIT');
    await page.fill('tbody tr:last-child td:nth-child(4) input', '2');
    await page.click('button:has-text("Save Actions")');
    await expect(page.locator('text="● Unsaved changes"')).not.toBeVisible();

    await page.click('button:has-text("Holdings & Audit")');
    await dateInput.fill('2024-04-01');
    await dateInput.press('Enter');
    
    await expect(page.locator('text="Holdings as of 2024-04-01"')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('td', { hasText: 'TSLA' }).first()).toBeVisible();
    await expect(page.locator('td', { hasText: '20.00' }).first()).toBeVisible({ timeout: 10000 });
    
    await page.click('button:has-text("Corporate Actions")');
    await expect(page.locator('tbody tr')).toHaveCount(1);
    await page.click('button:has-text("✕ Remove")');
    await page.click('button:has-text("Save Actions")');
    await expect(page.locator('text="● Unsaved changes"')).not.toBeVisible();

    await page.click('button:has-text("Holdings & Audit")');
    // For this one, the default date after deletion is the last trade date (Jan 10)
    // Or we can just set it to April 1st again
    await dateInput.fill('2024-04-01');
    await dateInput.press('Enter');
    await expect(page.locator('td', { hasText: '10.00' }).first()).toBeVisible({ timeout: 10000 });
  });

  test('Scope Manager Move Validation', async ({ page }) => {
    await page.goto('/advanced');
    
    const fam1 = `Fam1_${Date.now()}`;
    await page.getByRole('button', { name: '＋ New Family', exact: true }).click();
    await page.fill('input[placeholder="Family name"]', fam1);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    
    const fam1Btn = page.locator('button', { hasText: fam1 }).first();
    await expect(fam1Btn).toBeVisible({ timeout: 10000 });
    await fam1Btn.click();

    await page.getByRole('button', { name: '＋ Add Client', exact: true }).click();
    await page.fill('input[placeholder="Client name"]', 'Client1');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    
    const client1Btn = page.locator('button', { hasText: 'Client1' }).first();
    await expect(client1Btn).toBeVisible();
    await client1Btn.click();

    await page.getByRole('button', { name: '＋ Add Portfolio', exact: true }).click();
    await page.fill('input[placeholder="Portfolio / Broker name"]', 'Broker1');
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    
    const broker1Btn = page.locator('button', { hasText: 'Broker1' }).first();
    await expect(broker1Btn).toBeVisible();

    const fam2 = `Fam2_${Date.now()}`;
    await page.getByRole('button', { name: '＋ New Family', exact: true }).click();
    await page.fill('input[placeholder="Family name"]', fam2);
    await page.getByRole('button', { name: 'Create', exact: true }).click();
    await expect(page.locator('button', { hasText: fam2 }).first()).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Manage Scopes")');
    await expect(page.locator('h2', { hasText: /Scope/i })).toBeVisible();
    
    await page.selectOption('select', 'user');
    await page.fill('input[placeholder="Old User ID"]', 'Client1');
    await page.fill('input[placeholder="Old Family ID"]', fam1);
    await page.fill('input[placeholder="New Family ID"]', fam2);
    
    let dialogAppeared = false;
    page.on('dialog', dialog => {
      dialogAppeared = true;
      expect(dialog.message()).toContain('Scope successfully regrouped!');
      dialog.accept();
    });
    
    await page.click('button:has-text("Confirm Move")');
    
    // Wait for modal to disappear (since onClose is called)
    await expect(page.locator('h2', { hasText: /Scope/i })).not.toBeVisible({ timeout: 10000 });
    expect(dialogAppeared).toBe(true);

    await page.locator('button', { hasText: fam2 }).first().click();
    await expect(page.locator('button', { hasText: 'Client1' }).last()).toBeVisible({ timeout: 10000 });
  });
});
