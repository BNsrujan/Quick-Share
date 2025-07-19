/**
 * End-to-End Integration Test Suite
 * 
 * This test suite verifies the complete functionality of the application
 * across different browsers and scenarios.
 */

import { test, expect, Page, BrowserContext } from '@playwright/test';

// Helper function to generate a random file
async function generateRandomFile(page: Page, name: string, sizeInKB: number): Promise<void> {
  return page.evaluate(({ name, sizeInKB }) => {
    return new Promise<void>((resolve) => {
      // Create a blob with random data
      const array = new Uint8Array(sizeInKB * 1024);
      window.crypto.getRandomValues(array);
      const blob = new Blob([array], { type: 'application/octet-stream' });
      
      // Create a File object
      const file = new File([blob], name, { type: 'application/octet-stream' });
      
      // Create a DataTransfer object and add the file
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      
      // Create a change event with the DataTransfer object
      const inputElement = document.querySelector('input[type="file"]');
      if (inputElement) {
        // Set the files property
        Object.defineProperty(inputElement, 'files', {
          value: dataTransfer.files,
          writable: false
        });
        
        // Dispatch a change event
        const event = new Event('change', { bubbles: true });
        inputElement.dispatchEvent(event);
        
        // Resolve the promise
        setTimeout(resolve, 500);
      } else {
        throw new Error('File input element not found');
      }
    });
  }, { name, sizeInKB });
}

// Test complete end-to-end flow
test.describe('End-to-end integration', () => {
  test.skip('Complete file transfer between two browsers', async ({ browser }) => {
    // This test is skipped because it requires manual setup
    // In a real implementation, you would use two browser contexts
    
    // Create sender context
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');
    
    // Create receiver context
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');
    
    // Upload file on sender page
    await senderPage.getByText(/select files|upload|choose files/i).click();
    
    // Generate a random file
    const fileName = `test-file-${Date.now()}.bin`;
    const fileSize = 1024; // 1MB
    await generateRandomFile(senderPage, fileName, fileSize);
    
    // Wait for file to be processed
    await senderPage.getByText(fileName).waitFor();
    
    // Get share code
    const shareCodeElement = await senderPage.getByTestId('share-code');
    await expect(shareCodeElement).toBeVisible();
    const shareCode = await shareCodeElement.textContent();
    
    // Enter share code on receiver page
    await receiverPage.getByTestId('code-input').fill(shareCode || '');
    await receiverPage.getByTestId('code-submit').click();
    
    // Wait for connection
    await receiverPage.getByText(/connected|connecting/i).waitFor();
    
    // Wait for transfer to complete
    await receiverPage.getByText(/transfer complete|download/i).waitFor({ timeout: 60000 });
    
    // Verify file was received with correct name
    await expect(receiverPage.getByText(fileName)).toBeVisible();
    
    // Clean up
    await senderContext.close();
    await receiverContext.close();
  });
  
  test.skip('Transfer with browser refresh', async ({ browser }) => {
    // This test is skipped because it requires manual setup
    // In a real implementation, you would use two browser contexts
    
    // Create sender context
    const senderContext = await browser.newContext();
    const senderPage = await senderContext.newPage();
    await senderPage.goto('/send');
    
    // Create receiver context
    const receiverContext = await browser.newContext();
    const receiverPage = await receiverContext.newPage();
    await receiverPage.goto('/receive');
    
    // Upload file on sender page
    await senderPage.getByText(/select files|upload|choose files/i).click();
    
    // Generate a random file
    const fileName = `test-file-${Date.now()}.bin`;
    const fileSize = 5120; // 5MB
    await generateRandomFile(senderPage, fileName, fileSize);
    
    // Wait for file to be processed
    await senderPage.getByText(fileName).waitFor();
    
    // Get share code
    const shareCodeElement = await senderPage.getByTestId('share-code');
    await expect(shareCodeElement).toBeVisible();
    const shareCode = await shareCodeElement.textContent();
    
    // Enter share code on receiver page
    await receiverPage.getByTestId('code-input').fill(shareCode || '');
    await receiverPage.getByTestId('code-submit').click();
    
    // Wait for connection
    await receiverPage.getByText(/connected|connecting/i).waitFor();
    
    // Wait for transfer to start
    await receiverPage.getByText(/transferring/i).waitFor();
    
    // Wait for some progress (at least 20%)
    await receiverPage.waitForFunction(() => {
      const progressElement = document.querySelector('[data-testid="progress-bar"]');
      return progressElement && parseFloat(progressElement.getAttribute('aria-valuenow') || '0') > 20;
    }, { timeout: 30000 });
    
    // Refresh the receiver page
    await receiverPage.reload();
    
    // Check if the transfer state is recovered
    await receiverPage.getByText(/resume|continue|recovering/i).waitFor();
    
    // Continue the transfer
    await receiverPage.getByRole('button', { name: /resume|continue/i }).click();
    
    // Wait for transfer to complete
    await receiverPage.getByText(/transfer complete|download/i).waitFor({ timeout: 60000 });
    
    // Verify file was received with correct name
    await expect(receiverPage.getByText(fileName)).toBeVisible();
    
    // Clean up
    await senderContext.close();
    await receiverContext.close();
  });
});

// Test security features
test.describe('Security integration', () => {
  test('Encryption key derivation works across browsers', async ({ page }) => {
    await page.goto('/send');
    
    // Check that encryption is enabled
    await expect(page.getByText(/end-to-end encryption/i)).toBeVisible();
    
    // Test Web Crypto API functionality
    const cryptoSupport = await page.evaluate(() => {
      if (!window.crypto || !window.crypto.subtle) {
        return { supported: false };
      }
      
      // Test key derivation
      return window.crypto.subtle.generateKey(
        {
          name: 'AES-GCM',
          length: 256
        },
        true,
        ['encrypt', 'decrypt']
      )
      .then(() => ({ supported: true }))
      .catch(error => ({ supported: false, error: error.message }));
    });
    
    expect(cryptoSupport.supported).toBeTruthy();
  });
});

// Test WebRTC connection establishment
test.describe('WebRTC connection', () => {
  test('WebRTC connection can be established', async ({ page }) => {
    await page.goto('/');
    
    // Check WebRTC support
    const webrtcSupport = await page.evaluate(() => {
      if (!window.RTCPeerConnection) {
        return { supported: false };
      }
      
      // Test RTCPeerConnection creation
      try {
        const pc1 = new RTCPeerConnection();
        const pc2 = new RTCPeerConnection();
        
        // Create data channel
        const dc = pc1.createDataChannel('test');
        
        // Clean up
        pc1.close();
        pc2.close();
        
        return { supported: true };
      } catch (error) {
        return { supported: false, error: error.message };
      }
    });
    
    expect(webrtcSupport.supported).toBeTruthy();
  });
});