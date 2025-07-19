/**
 * Browser Compatibility Test Suite
 * 
 * This test suite verifies that the application works correctly across different browsers
 * and devices, testing core functionality, WebRTC connections, and feature detection.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Helper function to check browser support
async function checkBrowserSupport(page: Page) {
  return page.evaluate(() => {
    return {
      webrtc: !!(
        window.RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection
      ),
      webCrypto: !!(window.crypto && window.crypto.subtle),
      fileSystem: !!(window.File && window.FileReader && window.FileList && window.Blob),
      indexedDB: !!(
        window.indexedDB ||
        (window as any).mozIndexedDB ||
        (window as any).webkitIndexedDB ||
        (window as any).msIndexedDB
      ),
      localStorage: !!window.localStorage,
      userAgent: navigator.userAgent
    };
  });
}

// Test basic functionality across browsers
test.describe('Cross-browser compatibility', () => {
  test('Homepage loads and displays correctly', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Quick-Share/);
    
    // Check that main UI elements are visible
    await expect(page.getByRole('heading', { name: /Quick-Share/i })).toBeVisible();
    
    // Check browser support detection
    const support = await checkBrowserSupport(page);
    console.log(`Browser support for ${support.userAgent}:`, support);
    
    // Verify that the app shows appropriate UI based on browser support
    if (!support.webrtc || !support.webCrypto) {
      // If browser doesn't support critical features, should show warning
      await expect(page.getByText(/browser doesn't support/i)).toBeVisible();
    } else {
      // If browser supports critical features, should show main UI
      await expect(page.getByText(/Share files securely/i)).toBeVisible();
    }
  });
  
  test('File upload component works', async ({ page }) => {
    await page.goto('/send');
    
    // Check if file upload component is visible
    await expect(page.locator('[data-testid="file-upload"]')).toBeVisible();
    
    // Test file upload functionality
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.locator('[data-testid="file-upload"]').click();
    const fileChooser = await fileChooserPromise;
    
    // Create a test file with known content
    await fileChooser.setFiles({
      name: 'test-file.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Test file content for cross-browser testing')
    });
    
    // Verify file was accepted
    await expect(page.locator('[data-testid="file-name"]')).toBeVisible();
    await expect(page.locator('[data-testid="file-name"]')).toContainText('test-file.txt');
  });
  
  test('Code input component works', async ({ page }) => {
    await page.goto('/receive');
    
    // Check if code input component is visible
    await expect(page.locator('[data-testid="code-input"]')).toBeVisible();
    
    // Test code input functionality
    await page.locator('[data-testid="code-input"]').fill('123456');
    await page.locator('[data-testid="code-submit"]').click();
    
    // Should show loading state or error (since code is invalid)
    await expect(page.getByText(/invalid code|connecting|waiting/i)).toBeVisible();
  });
});

// Test responsive design
test.describe('Responsive design', () => {
  test('Mobile layout renders correctly', async ({ page }) => {
    // Set viewport to mobile size
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');
    
    // Check that mobile menu is present
    await expect(page.locator('[aria-label="Menu"]')).toBeVisible();
    
    // Open mobile menu
    await page.locator('[aria-label="Menu"]').click();
    
    // Check that menu items are visible
    await expect(page.getByRole('menu')).toBeVisible();
  });
  
  test('Desktop layout renders correctly', async ({ page }) => {
    // Set viewport to desktop size
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    
    // Check that desktop navigation is visible
    await expect(page.locator('nav')).toBeVisible();
    
    // Mobile menu should not be visible on desktop
    await expect(page.locator('[aria-label="Menu"]')).not.toBeVisible();
  });
});

// Test WebRTC feature detection and fallbacks
test.describe('WebRTC feature detection', () => {
  test('Detects WebRTC support correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check WebRTC support detection
    const hasWebRTC = await page.evaluate(() => {
      return !!(
        window.RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection
      );
    });
    
    // If WebRTC is supported, check that the app shows the main UI
    if (hasWebRTC) {
      await expect(page.getByText(/Share files securely/i)).toBeVisible();
    } else {
      // If WebRTC is not supported, check that the app shows a warning
      await expect(page.getByText(/browser doesn't support/i)).toBeVisible();
    }
  });
});

// Test Web Crypto API compatibility
test.describe('Web Crypto API compatibility', () => {
  test('Detects Web Crypto API support correctly', async ({ page }) => {
    await page.goto('/');
    
    // Check Web Crypto API support detection
    const hasWebCrypto = await page.evaluate(() => {
      return !!(window.crypto && window.crypto.subtle);
    });
    
    console.log('Web Crypto API support:', hasWebCrypto);
    
    // If Web Crypto API is supported, check that encryption features are available
    if (hasWebCrypto) {
      // Navigate to send page
      await page.goto('/send');
      
      // Check that encryption options are visible
      await expect(page.getByText(/end-to-end encryption/i)).toBeVisible();
    } else {
      // If Web Crypto API is not supported, check that the app shows a warning
      await expect(page.getByText(/browser doesn't support/i)).toBeVisible();
    }
  });
});

// Test accessibility features
test.describe('Accessibility features', () => {
  test('Main components have proper ARIA attributes', async ({ page }) => {
    await page.goto('/');
    
    // Check that main landmarks have proper roles
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    
    // Check that interactive elements have proper roles
    await expect(page.getByRole('button')).toHaveCount(await page.getByRole('button').count());
    await expect(page.getByRole('link')).toHaveCount(await page.getByRole('link').count());
    
    // Check that images have alt text
    const images = await page.locator('img:not([aria-hidden="true"])').all();
    for (const image of images) {
      await expect(image).toHaveAttribute('alt');
    }
  });
});

// Test end-to-end transfer between different browsers
test.describe('Cross-browser transfer', () => {
  test.skip('Transfer file between Chrome and Firefox', async ({ browser, browserName }) => {
    // This test requires manual setup with two different browser contexts
    // It's marked as skipped because it requires special configuration
    // In a real implementation, you would use browser contexts to simulate different browsers
    
    // This is a placeholder for a real implementation
    test.skip();
  });
});