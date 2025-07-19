# Troubleshooting Guide

This guide provides solutions for common issues you might encounter when using or developing the Quick-Share P2P platform.

## Connection Issues

### Unable to Establish P2P Connection

**Symptoms:**
- "Waiting for connection..." message that never resolves
- "Connection failed" error message
- Timeout when trying to connect peers

**Possible Causes and Solutions:**

1. **WebRTC Not Supported**
   - **Cause:** The browser doesn't support WebRTC or has it disabled
   - **Solution:** Use a modern browser like Chrome, Firefox, Safari, or Edge
   - **Verification:** Check browser support at [WebRTC Is it ready?](https://caniuse.com/rtcpeerconnection)

2. **Firewall or Network Restrictions**
   - **Cause:** Corporate firewalls or networks blocking WebRTC traffic
   - **Solution:** 
     - Try on a different network
     - Check with network administrator about WebRTC restrictions
     - Use a TURN server (contact platform administrator)
   - **Verification:** Check browser console for ICE connection failures

3. **Signaling Server Unreachable**
   - **Cause:** The signaling server is down or unreachable
   - **Solution:**
     - Verify the signaling server is running
     - Check network connectivity to the signaling server
   - **Verification:** Check browser console for WebSocket connection errors

4. **Incorrect Share Code**
   - **Cause:** The share code was entered incorrectly
   - **Solution:** Double-check the code and try again
   - **Verification:** Codes are 6 digits, case-sensitive

5. **Room Expired**
   - **Cause:** The sharing room has expired (default: 1 hour)
   - **Solution:** Create a new sharing session
   - **Verification:** Check for "Room not found" or "Room expired" messages

### Connection Drops During Transfer

**Symptoms:**
- Transfer progress stops
- "Connection lost" message appears
- Transfer gets stuck at a certain percentage

**Possible Causes and Solutions:**

1. **Unstable Network**
   - **Cause:** Network instability causing connection drops
   - **Solution:**
     - Use a more stable network connection
     - Try reducing the file size
     - Use the pause/resume feature to continue after reconnection
   - **Verification:** Check for network fluctuations or device sleep mode

2. **Browser Tab in Background**
   - **Cause:** Some browsers throttle background tabs
   - **Solution:** Keep the browser tab active during transfer
   - **Verification:** Test with the tab in focus

3. **Device Sleep Mode**
   - **Cause:** Device entering sleep mode interrupts connection
   - **Solution:** Keep device awake during transfers
   - **Verification:** Check power settings

## File Transfer Issues

### File Transfer Fails to Start

**Symptoms:**
- "Starting transfer..." message that never progresses
- No progress bar appears
- Error message about file handling

**Possible Causes and Solutions:**

1. **File Too Large**
   - **Cause:** File exceeds browser memory limits
   - **Solution:** Try with smaller files or split large files
   - **Verification:** Check browser console for memory-related errors

2. **Unsupported File Type**
   - **Cause:** Some file types might cause issues in certain browsers
   - **Solution:** Try with a different file format
   - **Verification:** Test with common file types like .txt or .jpg

3. **Permission Issues**
   - **Cause:** Browser lacks permission to access the file
   - **Solution:** Ensure proper permissions when selecting files
   - **Verification:** Check browser console for permission errors

### Slow Transfer Speeds

**Symptoms:**
- Transfer progresses very slowly
- Estimated time keeps increasing
- Speed indicator shows low values

**Possible Causes and Solutions:**

1. **Network Bandwidth Limitations**
   - **Cause:** Limited bandwidth available
   - **Solution:**
     - Use a faster network connection
     - Close other bandwidth-intensive applications
   - **Verification:** Run a speed test to check available bandwidth

2. **Single Channel Transfer**
   - **Cause:** Multiple data channels not being utilized
   - **Solution:** Ensure browser supports multiple data channels
   - **Verification:** Check browser console for channel creation logs

3. **Large Chunk Size**
   - **Cause:** Inefficient chunk size for the connection
   - **Solution:** The application should adapt automatically, but may need tuning
   - **Verification:** Monitor memory usage during transfer

### File Corruption After Transfer

**Symptoms:**
- Received file cannot be opened
- File size differs from original
- Checksum verification fails

**Possible Causes and Solutions:**

1. **Transfer Interrupted**
   - **Cause:** Connection dropped during transfer
   - **Solution:** Retry the transfer
   - **Verification:** Check if transfer completed 100%

2. **Encryption/Decryption Error**
   - **Cause:** Issue with the encryption or decryption process
   - **Solution:** Retry with a new sharing session
   - **Verification:** Check browser console for crypto-related errors

3. **Browser Compatibility Issue**
   - **Cause:** Different implementations of WebRTC or Web Crypto API
   - **Solution:** Try with the same browser on both ends
   - **Verification:** Test with Chrome on both sender and receiver

## Encryption Issues

### "Encryption Not Supported" Error

**Symptoms:**
- Error message about encryption not being supported
- Transfer fails to start with security error

**Possible Causes and Solutions:**

1. **Web Crypto API Not Supported**
   - **Cause:** Browser doesn't support the Web Crypto API
   - **Solution:** Use a modern browser with Web Crypto API support
   - **Verification:** Check browser compatibility at [Can I Use Web Crypto](https://caniuse.com/cryptography)

2. **Insecure Context**
   - **Cause:** Web Crypto API requires HTTPS in production
   - **Solution:** Ensure the application is served over HTTPS
   - **Verification:** Check if using HTTP instead of HTTPS (except for localhost)

### Key Derivation Failures

**Symptoms:**
- "Unable to generate encryption keys" error
- Transfer fails during initialization

**Possible Causes and Solutions:**

1. **Insufficient Entropy**
   - **Cause:** System lacks sufficient entropy for secure random generation
   - **Solution:** Move mouse or interact with the device to generate entropy
   - **Verification:** Check browser console for crypto-related warnings

2. **Browser Implementation Differences**
   - **Cause:** Different browsers implement crypto algorithms differently
   - **Solution:** Try with a different browser
   - **Verification:** Test in Chrome, which has the most complete implementation

## Browser-Specific Issues

### Safari

**Issues:**
- Limited WebRTC support on older versions
- Connection establishment may require user interaction
- IndexedDB limitations in Private Browsing

**Solutions:**
- Use Safari 14.1+ for best compatibility
- Ensure user interacts with the page before connection attempts
- Inform users about limitations in Private Browsing mode

### Firefox

**Issues:**
- Private Browsing mode limits IndexedDB (affects pause/resume)
- Some WebRTC features have different implementations

**Solutions:**
- Inform users about limitations in Private Browsing
- Test specifically in Firefox during development
- Use feature detection rather than browser detection

### Mobile Browsers

**Issues:**
- Limited screen space affects UI
- Background tabs may be suspended
- Power saving modes interrupt connections

**Solutions:**
- Keep the app in the foreground during transfers
- Disable power saving during large transfers
- Use responsive design that works well on small screens

## Authentication Issues

### Google Sign-In Fails

**Symptoms:**
- "Authentication failed" error
- Redirect loop during sign-in
- Returns to sign-in page after authentication attempt

**Possible Causes and Solutions:**

1. **Invalid OAuth Configuration**
   - **Cause:** Incorrect client ID or secret
   - **Solution:** Verify OAuth credentials in environment variables
   - **Verification:** Check browser console for authentication errors

2. **Redirect URI Mismatch**
   - **Cause:** Authorized redirect URIs don't match actual URI
   - **Solution:** Update redirect URIs in Google Cloud Console
   - **Verification:** Check error message for redirect URI issues

3. **Cookies Disabled**
   - **Cause:** Browser has cookies disabled
   - **Solution:** Enable cookies for the site
   - **Verification:** Check browser settings for cookie restrictions

## Development Environment Issues

### Next.js Development Server Errors

**Symptoms:**
- Build errors when starting development server
- Hot reload not working
- TypeScript errors

**Possible Causes and Solutions:**

1. **Missing Dependencies**
   - **Cause:** Not all dependencies are installed
   - **Solution:** Run `npm install` to ensure all dependencies are installed
   - **Verification:** Check for error messages about missing modules

2. **TypeScript Errors**
   - **Cause:** Type errors in the codebase
   - **Solution:** Fix type errors indicated in the console
   - **Verification:** Run `npm run type-check` to see all type errors

3. **Next.js Cache Issues**
   - **Cause:** Corrupted Next.js cache
   - **Solution:** Delete the `.next` directory and restart
   - **Verification:** Run `rm -rf .next` and then `npm run dev`

### Signaling Server Issues

**Symptoms:**
- Server fails to start
- WebSocket connection errors
- Room creation fails

**Possible Causes and Solutions:**

1. **Redis Connection Issues**
   - **Cause:** Redis not running or connection issues
   - **Solution:**
     - Ensure Redis is running
     - Check Redis connection string
     - Set `REDIS_ENABLED=false` for development
   - **Verification:** Check server logs for Redis connection errors

2. **Port Already in Use**
   - **Cause:** Another process is using the configured port
   - **Solution:** Change the port in `.env` or stop the other process
   - **Verification:** Check for "EADDRINUSE" errors in the console

3. **Environment Configuration**
   - **Cause:** Missing or incorrect environment variables
   - **Solution:** Verify all required variables in `.env`
   - **Verification:** Compare with `.env.example`

## Reporting Issues

If you encounter issues not covered in this guide:

1. **Check Browser Console**
   - Open browser developer tools (F12 or Ctrl+Shift+I)
   - Look for error messages in the Console tab

2. **Check Server Logs**
   - Review signaling server logs for backend issues
   - Look for error patterns or specific error codes

3. **Report the Issue**
   - Include browser name and version
   - Describe the steps to reproduce
   - Share relevant error messages
   - Mention network environment (corporate network, VPN, etc.)
   - Include file types and sizes if relevant

## Additional Resources

- [WebRTC Troubleshooting](https://webrtc.org/getting-started/troubleshooting)
- [MDN Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)
- [Browser Compatibility Documentation](browser-compatibility.md)
- [Installation Guide](installation-guide.md)
- [Deployment Guide](deployment-guide.md)