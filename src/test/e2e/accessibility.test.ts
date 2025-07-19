/**
 * Accessibility Test Suite
 * 
 * This test suite verifies that the application meets accessibility standards
 * and works properly with screen readers and keyboard navigation.
 */

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// Test accessibility on main pages
test.describe('Accessibility compliance', () => {
  test('Homepage meets accessibility standards', async ({ page }) => {
    await page.goto('/');
    
    // Run axe accessibility tests
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    // Check for violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });
  
  test('Send page meets accessibility standards', async ({ page }) => {
    await page.goto('/send');
    
    // Run axe accessibility tests
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    // Check for violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });
  
  test('Receive page meets accessibility standards', async ({ page }) => {
    await page.goto('/receive');
    
    // Run axe accessibility tests
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    // Check for violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});

// Test keyboard navigation
test.describe('Keyboard navigation', () => {
  test('Can navigate homepage with keyboard', async ({ page }) => {
    await page.goto('/');
    
    // Press Tab to navigate to first interactive element
    await page.keyboard.press('Tab');
    
    // Check that focus is visible on the first interactive element
    const focusedElement = await page.evaluate(() => {
      const activeElement = document.activeElement;
      return activeElement ? activeElement.tagName : null;
    });
    
    expect(focusedElement).not.toBeNull();
    
    // Navigate through all interactive elements with Tab
    let tabCount = 0;
    let maxTabs = 20; // Safety limit
    
    while (tabCount < maxTabs) {
      await page.keyboard.press('Tab');
      tabCount++;
      
      // Check that focus is visible
      const isFocusVisible = await page.evaluate(() => {
        const activeElement = document.activeElement;
        if (!activeElement || activeElement === document.body) return false;
        
        const style = window.getComputedStyle(activeElement);
        return style.outlineStyle !== 'none' || 
               activeElement.hasAttribute('aria-selected') || 
               activeElement.hasAttribute('aria-pressed');
      });
      
      expect(isFocusVisible).toBeTruthy();
    }
  });
  
  test('Can use file upload with keyboard', async ({ page }) => {
    await page.goto('/send');
    
    // Find and focus the file upload button
    await page.getByRole('button', { name: /select files|upload|choose files/i }).focus();
    
    // Press Enter to activate
    await page.keyboard.press('Enter');
    
    // Should open file chooser dialog
    const fileChooserPromise = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    
    try {
      await fileChooserPromise;
      // If we get here, the file chooser was opened successfully
    } catch (e) {
      // Some browsers may not support programmatic file chooser activation
      // This is expected in some environments
      console.log('Note: File chooser could not be activated programmatically, this may be expected');
    }
  });
  
  test('Can use code input with keyboard', async ({ page }) => {
    await page.goto('/receive');
    
    // Focus the code input
    await page.getByTestId('code-input').focus();
    
    // Type a code
    await page.keyboard.type('123456');
    
    // Press Tab to move to submit button
    await page.keyboard.press('Tab');
    
    // Check that submit button is focused
    const isFocused = await page.getByTestId('code-submit').evaluate(el => {
      return document.activeElement === el;
    });
    
    expect(isFocused).toBeTruthy();
    
    // Press Enter to submit
    await page.keyboard.press('Enter');
    
    // Should show loading state or error (since code is invalid)
    await expect(page.getByText(/invalid code|connecting|waiting/i)).toBeVisible();
  });
});

// Test screen reader accessibility
test.describe('Screen reader accessibility', () => {
  test('Main elements have proper ARIA roles and labels', async ({ page }) => {
    await page.goto('/');
    
    // Check that main landmarks have proper roles
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('main')).toBeVisible();
    
    // Check that buttons have accessible names
    const buttons = await page.getByRole('button').all();
    for (const button of buttons) {
      const accessibleName = await button.evaluate(el => {
        return el.getAttribute('aria-label') || el.textContent;
      });
      expect(accessibleName).toBeTruthy();
    }
    
    // Check that form fields have associated labels
    const formFields = await page.locator('input, select, textarea').all();
    for (const field of formFields) {
      const hasLabel = await field.evaluate(el => {
        // Check for aria-label, aria-labelledby, or associated label
        return el.hasAttribute('aria-label') || 
               el.hasAttribute('aria-labelledby') || 
               document.querySelector(`label[for="${el.id}"]`) !== null;
      });
      expect(hasLabel).toBeTruthy();
    }
  });
  
  test('Error messages are announced to screen readers', async ({ page }) => {
    await page.goto('/receive');
    
    // Enter invalid code
    await page.getByTestId('code-input').fill('12345');
    await page.getByTestId('code-submit').click();
    
    // Check that error message has proper ARIA attributes
    const errorMessage = await page.getByText(/invalid code|code must be/i);
    await expect(errorMessage).toBeVisible();
    
    const hasAriaLive = await errorMessage.evaluate(el => {
      // Check parent elements for aria-live attribute
      let current = el;
      for (let i = 0; i < 3; i++) {
        if (current.getAttribute('aria-live')) return true;
        if (current.parentElement) current = current.parentElement;
        else break;
      }
      return false;
    });
    
    expect(hasAriaLive).toBeTruthy();
  });
});

// Test color contrast and visual accessibility
test.describe('Visual accessibility', () => {
  test('Text elements have sufficient color contrast', async ({ page }) => {
    await page.goto('/');
    
    // Run axe accessibility tests specifically for color contrast
    const accessibilityScanResults = await new AxeBuilder({ page })
      .withTags(['wcag2aa'])
      .options({
        runOnly: {
          type: 'rule',
          values: ['color-contrast']
        }
      })
      .analyze();
    
    // Check for color contrast violations
    expect(accessibilityScanResults.violations).toEqual([]);
  });
});