# Browser Compatibility Testing Guide

This guide provides instructions for testing the Quick-Share P2P platform across different browsers and devices to ensure compatibility and accessibility.

## Prerequisites

Before running the tests, make sure you have the following installed:

1. Node.js (v16 or later)
2. npm or yarn
3. Playwright browsers (run `npx playwright install` if not already installed)

## Available Test Commands

We've added several npm scripts to make browser testing easier:

```bash
# Run all browser compatibility tests
npm run test:browser-compat

# Run accessibility tests
npm run test:accessibility

# Run tests in specific browsers
npm run test:chrome
npm run test:firefox
npm run test:safari

# Run tests on mobile viewports
npm run test:mobile

# Run all e2e tests with UI mode for debugging
npm run test:e2e:ui
```

## Manual Testing Checklist

While automated tests cover many scenarios, manual testing is still important for certain aspects:

### Core Functionality

- [ ] File upload works in all target browsers
- [ ] Share code generation and display works correctly
- [ ] Joining a room with a share code works
- [ ] File transfer completes successfully
- [ ] Download of received file works
- [ ] Pause/resume functionality works as expected

### Browser-Specific Features

- [ ] WebRTC connection establishes correctly in all browsers
- [ ] Encryption/decryption works in all browsers
- [ ] IndexedDB storage works for transfer state persistence
- [ ] File handling APIs work correctly

### Mobile Testing

- [ ] UI is responsive and usable on small screens
- [ ] Touch interactions work correctly
- [ ] Virtual keyboard doesn't obscure important UI elements
- [ ] Orientation changes don't break the UI

### Accessibility Testing

- [ ] Screen readers can navigate the application
- [ ] Keyboard navigation works for all interactive elements
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus indicators are visible
- [ ] ARIA attributes are correctly implemented

## Testing with Different Network Conditions

To test with different network conditions:

1. Use Chrome DevTools Network throttling
2. Use browser's developer tools to simulate different network conditions
3. Use the Network Link Conditioner on macOS or similar tools on other platforms

## Known Issues and Workarounds

### Safari WebRTC Limitations

- Safari requires user interaction before establishing WebRTC connections
- Workaround: Ensure users click a button before attempting connection

### Firefox Private Browsing

- IndexedDB may not work in Private Browsing mode
- Workaround: Detect private browsing and inform users of limited functionality

### Mobile Browsers

- Some mobile browsers have limited WebRTC support
- Workaround: Detect capabilities and show appropriate messaging

## Reporting Browser Compatibility Issues

When reporting browser compatibility issues:

1. Specify the browser name and version
2. Describe the steps to reproduce the issue
3. Include any error messages from the browser console
4. Note the operating system and device type
5. Provide screenshots if applicable

## Continuous Integration

Our CI pipeline runs browser compatibility tests on:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Mobile Chrome
- Mobile Safari

Tests are run on every pull request and before deployment to production.

## Adding New Browser Tests

To add new browser compatibility tests:

1. Create a new test file in `src/test/e2e/`
2. Use the Playwright test framework
3. Ensure tests run across all browser projects
4. Include appropriate assertions for browser-specific behavior

## Resources

- [Playwright Documentation](https://playwright.dev/docs/intro)
- [WebRTC Browser Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API#browser_compatibility)
- [Web Crypto API Browser Compatibility](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API#browser_compatibility)
- [WCAG Accessibility Guidelines](https://www.w3.org/WAI/standards-guidelines/wcag/)