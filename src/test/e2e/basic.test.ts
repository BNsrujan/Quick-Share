/**
 * Basic E2E test to verify Playwright setup
 */

import { test, expect } from '@playwright/test';

test('homepage has the correct title', async ({ page }) => {
  await page.goto('/');
  
  // Verify that the page title contains "Quick-Share"
  await expect(page).toHaveTitle(/Quick-Share/);
});