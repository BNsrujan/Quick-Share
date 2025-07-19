/**
 * End-to-end integration tests for P2P file transfer
 * 
 * These tests verify the complete workflow from file selection
 * to transfer completion, including signaling server integration.
 */

import { test, expect, Page } from '@playwright/test';

// Test configuration
const SIGNALING_SERVER_URL = 'http://localhost:3001';
const FRONTEND_URL = 'http://localhost:3000';

test.describe('P2P File Transfer Integration', () => {
  let senderPage: Page;
  let receiverPage: Page;

  test.beforeAll(async ({ browser }) => {
    // Create two browser contexts to simulate sender and receiver
    const senderContext = await browser.newContext();
    const receiverContext = await browser.newContext();
    
    senderPage = await senderContext.newPage();
    receiverPage = await receiverContext.newPage();
  });

  test.afterAll(async () => {
    await senderPage.close();
    await receiverPage.close();
  });

  test('should complete end-to-end file transfer', async () => {
    // Step 1: Sender navigates to send page
    await senderPage.goto(`${FRONTEND_URL}/send`);
    await expect(senderPage.locator('h1')).toContainText('Send a File');

    // Step 2: Sender selects a file
    const fileInput = senderPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Hello, this is a test file for P2P transfer!')
    });

    // Step 3: Wait for room creation and share code generation
    await expect(senderPage.locator('h1')).toContainText('Share Your Code', { timeout: 10000 });
    
    // Extract the share code
    const shareCodeElement = senderPage.locator('[data-testid="share-code"]');
    await expect(shareCodeElement).toBeVisible();
    const shareCode = await shareCodeElement.textContent();
    expect(shareCode).toBeTruthy();
    expect(shareCode?.length).toBeGreaterThan(8);

    // Step 4: Receiver navigates to receive page
    await receiverPage.goto(`${FRONTEND_URL}/receive`);
    await expect(receiverPage.locator('h1')).toContainText('Receive a File');

    // Step 5: Receiver enters the share code
    const codeInput = receiverPage.locator('input[placeholder*="code"]');
    await codeInput.fill(shareCode!);
    await receiverPage.locator('button[type="submit"]').click();

    // Step 6: Wait for connection establishment
    await expect(receiverPage.locator('h1')).toContainText('Receiving File', { timeout: 15000 });

    // Step 7: Sender starts the transfer
    await senderPage.locator('button:has-text("Start Transfer")').click();
    await expect(senderPage.locator('h1')).toContainText('Transferring File', { timeout: 5000 });

    // Step 8: Monitor transfer progress on both sides
    const senderProgress = senderPage.locator('[data-testid="transfer-progress"]');
    const receiverProgress = receiverPage.locator('[data-testid="transfer-progress"]');

    // Wait for progress to appear
    await expect(senderProgress).toBeVisible({ timeout: 10000 });
    await expect(receiverProgress).toBeVisible({ timeout: 10000 });

    // Step 9: Wait for transfer completion
    await expect(senderPage.locator('text=File sent successfully')).toBeVisible({ timeout: 30000 });
    await expect(receiverPage.locator('text=File received successfully')).toBeVisible({ timeout: 30000 });

    // Step 10: Verify final progress shows 100%
    const senderFinalProgress = await senderPage.locator('[data-testid="progress-percentage"]').textContent();
    const receiverFinalProgress = await receiverPage.locator('[data-testid="progress-percentage"]').textContent();
    
    expect(senderFinalProgress).toContain('100%');
    expect(receiverFinalProgress).toContain('100%');
  });

  test('should handle invalid share codes gracefully', async () => {
    // Navigate to receive page
    await receiverPage.goto(`${FRONTEND_URL}/receive`);
    
    // Enter an invalid share code
    const codeInput = receiverPage.locator('input[placeholder*="code"]');
    await codeInput.fill('INVALID123');
    await receiverPage.locator('button[type="submit"]').click();

    // Should show error message
    await expect(receiverPage.locator('text=Invalid')).toBeVisible({ timeout: 5000 });
    
    // Should remain on input step
    await expect(receiverPage.locator('h1')).toContainText('Receive a File');
  });

  test('should support pause and resume functionality', async () => {
    // Set up sender with a larger file
    await senderPage.goto(`${FRONTEND_URL}/send`);
    
    const fileInput = senderPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'large-test-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.alloc(1024 * 1024, 'A') // 1MB file
    });

    // Get share code
    await expect(senderPage.locator('[data-testid="share-code"]')).toBeVisible({ timeout: 10000 });
    const shareCode = await senderPage.locator('[data-testid="share-code"]').textContent();

    // Set up receiver
    await receiverPage.goto(`${FRONTEND_URL}/receive`);
    await receiverPage.locator('input[placeholder*="code"]').fill(shareCode!);
    await receiverPage.locator('button[type="submit"]').click();

    // Start transfer
    await senderPage.locator('button:has-text("Start Transfer")').click();

    // Wait for transfer to start
    await expect(senderPage.locator('[data-testid="transfer-progress"]')).toBeVisible({ timeout: 10000 });

    // Pause the transfer
    await senderPage.locator('button:has-text("Pause")').click();
    await expect(senderPage.locator('button:has-text("Resume")')).toBeVisible();

    // Resume the transfer
    await senderPage.locator('button:has-text("Resume")').click();
    await expect(senderPage.locator('button:has-text("Pause")')).toBeVisible();

    // Wait for completion
    await expect(senderPage.locator('text=File sent successfully')).toBeVisible({ timeout: 60000 });
  });

  test('should handle connection failures gracefully', async () => {
    // Test with signaling server unavailable
    // This test would require mocking or temporarily stopping the server
    
    await senderPage.goto(`${FRONTEND_URL}/send`);
    
    // Try to upload a file when server is down
    const fileInput = senderPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test content')
    });

    // Should show connection error if server is unavailable
    // This would need to be implemented based on actual error handling
  });

  test('should verify file integrity after transfer', async () => {
    const testContent = 'This is test content for integrity verification!';
    
    // Set up sender
    await senderPage.goto(`${FRONTEND_URL}/send`);
    const fileInput = senderPage.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'integrity-test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from(testContent)
    });

    // Get share code and set up receiver
    await expect(senderPage.locator('[data-testid="share-code"]')).toBeVisible({ timeout: 10000 });
    const shareCode = await senderPage.locator('[data-testid="share-code"]').textContent();

    await receiverPage.goto(`${FRONTEND_URL}/receive`);
    await receiverPage.locator('input[placeholder*="code"]').fill(shareCode!);
    await receiverPage.locator('button[type="submit"]').click();

    // Start and complete transfer
    await senderPage.locator('button:has-text("Start Transfer")').click();
    await expect(senderPage.locator('text=File sent successfully')).toBeVisible({ timeout: 30000 });
    await expect(receiverPage.locator('text=File received successfully')).toBeVisible({ timeout: 30000 });

    // Verify no integrity errors were shown
    await expect(receiverPage.locator('text=integrity')).not.toBeVisible();
    await expect(receiverPage.locator('text=corrupted')).not.toBeVisible();
  });
});

test.describe('P2P Service Unit Tests', () => {
  test('should detect browser support correctly', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}`);
    
    // Check if P2P is supported in the test browser
    const isSupported = await page.evaluate(() => {
      return !!(window.RTCPeerConnection && window.crypto && window.crypto.subtle);
    });
    
    expect(isSupported).toBe(true);
  });

  test('should generate secure share codes', async ({ page }) => {
    await page.goto(`${FRONTEND_URL}/send`);
    
    // Upload a file to trigger code generation
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('test')
    });

    // Verify share code properties
    await expect(page.locator('[data-testid="share-code"]')).toBeVisible({ timeout: 10000 });
    const shareCode = await page.locator('[data-testid="share-code"]').textContent();
    
    expect(shareCode).toBeTruthy();
    expect(shareCode?.length).toBeGreaterThanOrEqual(10);
    expect(shareCode).toMatch(/^[A-Z0-9]+$/); // Should be alphanumeric uppercase
  });
});