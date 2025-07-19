# User Guide

This guide explains how to use the Quick-Share P2P platform to securely share files directly between browsers.

## Getting Started

Quick-Share P2P is a browser-based file sharing platform that allows you to transfer files directly between devices without uploading them to any server. All transfers are end-to-end encrypted for maximum privacy and security.

### System Requirements

- **Desktop:** Chrome 80+, Firefox 78+, Safari 14.1+, Edge 80+
- **Mobile:** iOS Safari 14.1+, Chrome for Android, Firefox for Android
- **Internet Connection:** Any internet connection that allows WebRTC traffic
- **No Installation Required:** Works entirely in your browser

## Sharing Files

### Step 1: Access the Platform

1. Open your web browser
2. Navigate to the Quick-Share P2P website
3. Click on "Send Files" or navigate to the send page

### Step 2: Select Files

1. **Drag and Drop:** Drag files from your computer directly onto the drop zone
   
   OR
   
2. **Click to Browse:** Click on the drop zone to open a file browser dialog
3. Select one or multiple files to share (up to 10GB total)

### Step 3: Generate Sharing Code

1. After selecting files, the application will automatically generate a secure 6-digit sharing code
2. This code will be displayed prominently on your screen
3. The code is valid for 1 hour by default

### Step 4: Share the Code

1. Share the 6-digit code with the recipient through any communication channel (messaging app, email, phone call, etc.)
2. For security, it's best to share the code through a different channel than where you're discussing the file transfer

### Step 5: Monitor Transfer

1. Once the recipient enters the code, a connection will be established automatically
2. You'll see a progress indicator showing:
   - Connection status
   - Transfer progress percentage
   - Transfer speed
   - Estimated time remaining
3. You can pause, resume, or cancel the transfer at any time using the control buttons

### Step 6: Transfer Completion

1. When the transfer completes, you'll see a confirmation message
2. The connection will automatically close after completion
3. You can choose to share more files by starting a new session

## Receiving Files

### Step 1: Access the Platform

1. Open your web browser
2. Navigate to the Quick-Share P2P website
3. Click on "Receive Files" or navigate to the receive page

### Step 2: Enter Sharing Code

1. Ask the sender for their 6-digit sharing code
2. Enter the code in the input field
3. Click "Connect" or press Enter

### Step 3: Accept the Connection

1. After entering the code, the application will attempt to establish a connection
2. You'll see information about the file(s) being shared (name, size, type)
3. Click "Accept" to begin the transfer

### Step 4: Monitor Transfer

1. Once you accept, the transfer will begin automatically
2. You'll see a progress indicator showing:
   - Connection status
   - Transfer progress percentage
   - Transfer speed
   - Estimated time remaining
3. You can pause, resume, or cancel the transfer at any time using the control buttons

### Step 5: Save Received Files

1. When the transfer completes, your browser will automatically download the file(s)
2. Depending on your browser settings, you may be prompted to choose a save location
3. For multiple files, they may be downloaded individually or as a zip archive

## Advanced Features

### Pause and Resume Transfers

1. **To Pause:** Click the "Pause" button during an active transfer
2. The transfer state will be saved and the connection maintained
3. **To Resume:** Click the "Resume" button to continue from where you left off
4. If the connection is lost, the transfer can be resumed when reconnected

### Browser Refresh or Closure

1. If you accidentally refresh or close your browser during a transfer:
   - Open the Quick-Share P2P website again
   - The application will detect the interrupted transfer
   - You'll be prompted to resume the transfer
2. This feature works as long as you return within the session timeout period (typically 1 hour)

### Multiple File Transfers

1. You can select multiple files to transfer in a single session
2. Files are transferred sequentially for optimal performance
3. Progress is shown for both individual files and the overall transfer

### Transfer History (Optional)

If you choose to sign in with Google:

1. Your transfer history will be saved
2. You can view past transfers in the "History" section
3. History includes file names, sizes, transfer dates, and completion status
4. You can clear your history at any time

## Optional Authentication

### Signing In with Google

1. Click "Sign In" in the top right corner
2. Select your Google account
3. Grant the requested permissions
4. You'll be returned to the Quick-Share P2P platform

### Benefits of Signing In

- Access to transfer history
- Saved preferences across devices
- Higher rate limits for frequent users
- Optional contact saving for frequent recipients

### Privacy Note

- Authentication is completely optional
- All core functionality works without signing in
- Your files are never stored on any server, regardless of authentication status
- Transfer history only stores metadata (file names, sizes, dates), not the actual files

## Troubleshooting

### Connection Issues

If you're having trouble establishing a connection:

1. **Check Browser Compatibility:** Ensure you're using a supported browser
2. **Firewall Settings:** Some corporate networks block WebRTC traffic
3. **Try a Different Network:** Mobile data sometimes works when Wi-Fi doesn't
4. **Generate a New Code:** If all else fails, start a new sharing session

### Transfer Interruptions

If your transfer gets interrupted:

1. **Wait for Automatic Reconnection:** The application will try to reconnect automatically
2. **Manual Resume:** Click the "Resume" button if available
3. **Start New Session:** If resuming fails, you may need to start a new session

### File Size Limitations

1. **Browser Memory Limits:** Very large files (>2GB) may cause issues in some browsers
2. **Splitting Large Files:** Consider splitting very large files before transfer
3. **Multiple Sessions:** Transfer large files in multiple smaller sessions if needed

## Security Information

### End-to-End Encryption

1. All transfers are encrypted using AES-256-GCM
2. Encryption keys are derived from the sharing code and never leave your browser
3. The signaling server never has access to your files or encryption keys

### Share Code Security

1. Share codes have sufficient entropy to prevent brute force attacks
2. Codes expire after use or after 1 hour
3. For maximum security, share the code through a different channel than where you discuss the file transfer

### Privacy Guarantees

1. No server storage of files
2. No logging of file content or metadata
3. No tracking or analytics beyond essential functionality
4. All connections are direct peer-to-peer after initial signaling

## Keyboard Shortcuts

| Action | Shortcut |
|--------|----------|
| Select Files | Space or Enter (when focus is on drop zone) |
| Pause/Resume | Space (when focus is on control button) |
| Cancel | Escape |
| Copy Code | Ctrl+C (when code is selected) |

## Accessibility Features

Quick-Share P2P is designed to be accessible to all users:

1. **Screen Reader Support:** All elements are properly labeled for screen readers
2. **Keyboard Navigation:** Full functionality available without a mouse
3. **High Contrast Mode:** Compatible with browser and OS high contrast settings
4. **Text Scaling:** Interface adapts to browser text size settings

## Getting Help

If you encounter issues not covered in this guide:

1. Check the [Troubleshooting Guide](troubleshooting-guide.md) for more detailed solutions
2. Review the [Browser Compatibility Documentation](browser-compatibility.md) for known limitations
3. Contact support through the feedback form in the application

Remember that Quick-Share P2P is designed for simplicity and security. If you're having trouble, the simplest solution is often to generate a new sharing code and try again.