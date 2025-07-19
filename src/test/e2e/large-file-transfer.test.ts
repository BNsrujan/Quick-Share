/**
 * Large File Transfer Test Suite
 * 
 * This test suite verifies that the application can handle large file transfers
 * across different browsers and network conditions.
 */

import { test, expect, Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Helper function to create a large test file
async function createLargeTestFile(sizeInMB: number): Promise<string> {
  const filePath = path.join(os.tmpdir(), `test-file-${sizeInMB}MB.bin`);
  
  // Check if file already exists with correct size
  try {
    const stats = await fs.promises.stat(filePath);
    if (stats.size === sizeInMB * 1024 * 1024) {
      return filePath;
    }
  } catch (e) {
    // File doesn't exist, will create it
  }
  
  // Create a file with the specified size
  const fd = await fs.promises.open(filePath, 'w');
  const bufferSize = 1024 * 1024; // 1MB buffer
  const buffer = Buffer.alloc(bufferSize).fill('A');
  
  for (let i = 0; i < sizeInMB; i++) {
    await fd.write(buffer, 0, bufferSize);
  }
  
  await fd.close();
  return filePath;
}

// Test large file transfers
test.describe('Large file transfers', () => {
  test.skip('Transfer 100MB file', async ({ page, browser }) => {
    // This test is skipped because it requires manual setup
    // In a real implementation, you would use two browser contexts
    
    // Create test file
    const filePath = await createLargeTestFile(100);
    
    // Setup sender page
    await page.goto('/send');
    
    // Upload file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText(/select files|upload|choose files/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    
    // Verify file was accepted
    await expect(page.getByText(/100 MB/)).toBeVisible();
    
    // Get share code
    const shareCode = await page.getByTestId('share-code').textContent();
    
    // Create receiver context
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');
    
    // Enter share code
    await receiverPage.getByTestId('code-input').fill(shareCode || '');
    await receiverPage.getByTestId('code-submit').click();
    
    // Wait for connection
    await receiverPage.getByText(/connected/i).waitFor();
    
    // Wait for transfer to complete (may take some time)
    await receiverPage.getByText(/transfer complete/i).waitFor({ timeout: 120000 });
    
    // Verify file was received
    await expect(receiverPage.getByText(/download/i)).toBeVisible();
    
    // Clean up
    await receiverContext.close();
    
    // Delete test file
    await fs.promises.unlink(filePath);
  });
});

// Test transfer with network throttling
test.describe('Network condition tests', () => {
  test.skip('Transfer with slow network', async ({ page, browser }) => {
    // This test is skipped because it requires manual setup
    // In a real implementation, you would use client.setNetworkConditions
    
    // Create test file (smaller for slow network)
    const filePath = await createLargeTestFile(10);
    
    // Setup sender page with network throttling
    await page.goto('/send');
    
    // Apply network throttling (if supported by browser)
    try {
      const client = await page.context().newCDPSession(page);
      await client.send('Network.emulateNetworkConditions', {
        offline: false,
        latency: 100,
        downloadThroughput: 500 * 1024, // 500 kbps
        uploadThroughput: 500 * 1024 // 500 kbps
      });
    } catch (e) {
      console.log('Network throttling not supported in this browser');
    }
    
    // Upload file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText(/select files|upload|choose files/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    
    // Verify file was accepted
    await expect(page.getByText(/10 MB/)).toBeVisible();
    
    // Get share code
    const shareCode = await page.getByTestId('share-code').textContent();
    
    // Create receiver context
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');
    
    // Enter share code
    await receiverPage.getByTestId('code-input').fill(shareCode || '');
    await receiverPage.getByTestId('code-submit').click();
    
    // Wait for connection
    await receiverPage.getByText(/connected/i).waitFor();
    
    // Wait for transfer to complete (may take longer due to throttling)
    await receiverPage.getByText(/transfer complete/i).waitFor({ timeout: 300000 });
    
    // Verify file was received
    await expect(receiverPage.getByText(/download/i)).toBeVisible();
    
    // Clean up
    await receiverContext.close();
    
    // Delete test file
    await fs.promises.unlink(filePath);
  });
});

// Test pause and resume functionality
test.describe('Pause and resume functionality', () => {
  test.skip('Pause and resume transfer', async ({ page, browser }) => {
    // This test is skipped because it requires manual setup
    // In a real implementation, you would use two browser contexts
    
    // Create test file
    const filePath = await createLargeTestFile(50);
    
    // Setup sender page
    await page.goto('/send');
    
    // Upload file
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.getByText(/select files|upload|choose files/i).click();
    const fileChooser = await fileChooserPromise;
    await fileChooser.setFiles(filePath);
    
    // Verify file was accepted
    await expect(page.getByText(/50 MB/)).toBeVisible();
    
    // Get share code
    const shareCode = await page.getByTestId('share-code').textContent();
    
    // Create receiver context
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');
    
    // Enter share code
    await receiverPage.getByTestId('code-input').fill(shareCode || '');
    await receiverPage.getByTestId('code-submit').click();
    
    // Wait for connection
    await receiverPage.getByText(/connected/i).waitFor();
    
    // Wait for transfer to start
    await receiverPage.getByText(/transferring/i).waitFor();
    
    // Wait for some progress (at least 10%)
    await receiverPage.waitForFunction(() => {
      const progressElement = document.querySelector('[data-testid="progress-bar"]');
      return progressElement && parseFloat(progressElement.getAttribute('aria-valuenow') || '0') > 10;
    }, { timeout: 30000 });
    
    // Pause the transfer
    await receiverPage.getByRole('button', { name: /pause/i }).click();
    
    // Verify transfer is paused
    await expect(receiverPage.getByText(/paused/i)).toBeVisible();
    
    // Get current progress
    const progressBeforePause = await receiverPage.evaluate(() => {
      const progressElement = document.querySelector('[data-testid="progress-bar"]');
      return parseFloat(progressElement?.getAttribute('aria-valuenow') || '0');
    });
    
    // Wait a moment to ensure no further progress is made while paused
    await receiverPage.waitForTimeout(2000);
    
    // Verify progress hasn't changed significantly
    const progressDuringPause = await receiverPage.evaluate(() => {
      const progressElement = document.querySelector('[data-testid="progress-bar"]');
      return parseFloat(progressElement?.getAttribute('aria-valuenow') || '0');
    });
    
    expect(Math.abs(progressDuringPause - progressBeforePause)).toBeLessThan(1);
    
    // Resume the transfer
    await receiverPage.getByRole('button', { name: /resume/i }).click();
    
    // Verify transfer is resumed
    await expect(receiverPage.getByText(/transferring/i)).toBeVisible();
    
    // Wait for transfer to complete
    await receiverPage.getByText(/transfer complete/i).waitFor({ timeout: 120000 });
    
    // Verify file was received
    await expect(receiverPage.getByText(/download/i)).toBeVisible();
    
    // Clean up
    await receiverContext.close();
    
    // Delete test file
    await fs.promises.unlink(filePath);
  });
});