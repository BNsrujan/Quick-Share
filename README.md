# Quick-share

## **Why Are We Building This?**

Traditional file-sharing methods have major drawbacks:

- **Slow Transfers**: Large files take too much time to send.
- **Quality Loss**: Platforms like WhatsApp reduce image quality.
- **Security Risks**: Centralized services store and analyze data, compromising privacy.
- **Limited Accessibility**: Some platforms require logins, apps, or cloud storage.

**Solution:**

fileshare.io enables fast, secure, and direct P2P file transfers without a middleman, ensuring speed, privacy, and ease of use.

## **Key Features**

- **P2P File Sharing**: Direct device-to-device transfer with no middle server.
- **End-to-End Encryption**: Secure file transfers with robust encryption.
- **10x Faster Transfer Speeds**: Uses **parallel transfers & full network bandwidth**.
- **Pause & Resume Transfers**: Handles network issues seamlessly.
- **Offline Sharing**: Share files using a unique **one-time code**.
- **Web-Based Access**: No app required, just a simple **URL** to start sharing.

## **How It Works**

1. **User Uploads a File in route/page**
2. **people how are in that page can download the file with a cade**
3. **Direct P2P Transfer Ensures Speed & Privacy**

## **Technical Implementation**

### **Data Transmission & Storage**

- **WebRTC** – Direct P2P connections.
- **gRPC (Protocol Buffers)** – Optimized for low-latency file transfers.

### **Performance & Security Enhancements**

- **File Chunking & Parallel Transfers** – Splitting data into smaller parts for faster delivery.
- **Full Bandwidth Utilization** – Maximizing available network speed.
- **Port Management** – Securely allowing necessary connections.
- **MAC Address Validation** – Preventing unauthorized access.
- **End-to-End Encryption** – Ensuring data privacy during transmission.
- **Load Balancer & Elastic Servers** – Scaling with demand for stability.

## **User Actions**

- **Upload & Share** – Select files and generate a shareable link or code.
- **Receive & Download** – Enter the link or code to get the file.
- **Pause/Resume Transfers** – Control file sharing even with network issues.
- **Sign In (Optional)** – Use Google authentication for added features.

# Test Subjects 
   -  2 pdfs - 14.3mb 
   -  one photo - 2.01mb
=======
# Quick-Share P2P Platform

A browser-based, ultra-secure peer-to-peer file sharing platform that enables direct encrypted file transfers without central storage. Quick-Share provides a privacy-focused alternative to traditional file sharing services, offering faster speeds through parallel chunked transfers, complete end-to-end encryption, and the ability to pause/resume transfers.

## Features

- **Direct P2P File Transfer**: Files are transferred directly between browsers using WebRTC DataChannels without passing through any server
- **End-to-End Encryption**: All transfers are secured with AES-256-GCM encryption, with keys never leaving the browser
- **High-Speed Parallel Transfers**: Multiple WebRTC DataChannels for 10x faster transfers than traditional methods
- **Pause and Resume Functionality**: Interrupt and continue transfers without losing progress, even after browser refresh
- **Secure Code-Based Sharing**: Simple 6-digit codes for establishing connections with sufficient entropy to prevent brute force attacks
- **Browser-Based Interface**: Clean, intuitive UI that works across devices with no installation required
- **Optional Google Authentication**: Sign in with Google to access transfer history and preferences (not required for core functionality)
- **Cross-Platform Compatibility**: Works on all modern browsers including Chrome, Firefox, Safari, and Edge
- **Responsive Design**: Fully functional on both desktop and mobile devices
- **Accessibility Support**: WCAG AA compliant with screen reader and keyboard navigation support

## Architecture Overview

Quick-Share uses a modern web architecture with these key components:

1. **Frontend Application**: React-based Next.js application handling the user interface and P2P logic
2. **P2P Engine**: Core system managing WebRTC connections, encryption, and file transfers
3. **Signaling Server**: Minimal backend that only facilitates initial connections between peers

```
┌─────────────────┐    ┌─────────────────┐
│   Browser A     │    │   Browser B     │
│  (Sender)       │    │  (Receiver)     │
│                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ React SPA   │ │    │ │ React SPA   │ │
│ └─────────────┘ │    │ └─────────────┘ │
│ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ P2P Engine  │◄┼────┼►│ P2P Engine  │ │
│ └─────────────┘ │    │ └─────────────┘ │
└────────┬────────┘    └────────┬────────┘
         │                      │
         │  Initial Connection  │
         └──────────┬───────────┘
                    ▼
         ┌─────────────────────┐
         │  Signaling Server   │
         │  (Connection only)  │
         └─────────────────────┘
```

### Security Architecture

- **Zero Server Storage**: Files and encryption keys never touch any server
- **End-to-End Encryption**: AES-256-GCM for all file transfers
- **Key Derivation**: PBKDF2 with SHA-256, 100,000 iterations
- **Forward Secrecy**: New keys for each session, immediate disposal after use
- **Minimal Metadata**: Only connection facilitation data is logged

## Project Structure

```
quick-share-p2p/
├── docs/                # Documentation
│   ├── browser-compatibility.md    # Browser compatibility details
│   └── browser-testing-guide.md    # Guide for testing across browsers
├── public/              # Static assets
├── scripts/             # Utility scripts
│   └── run-browser-tests.sh        # Script for browser compatibility testing
├── src/
│   ├── app/             # Next.js app router pages
│   ├── components/      # React components
│   ├── contexts/        # React context providers
│   ├── hooks/           # Custom React hooks
│   ├── services/        # Service modules (WebRTC, crypto, etc.)
│   ├── test/            # Test files
│   │   ├── e2e/         # Playwright E2E tests
│   │   └── setup.ts     # Jest setup file
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Utility functions
├── server/              # Signaling server
│   ├── deploy/          # Deployment configurations
│   ├── src/             # Server source code
│   └── README.md        # Server documentation
├── .gitignore
├── jest.config.js       # Jest configuration
├── next.config.ts       # Next.js configuration
├── package.json         # Project dependencies
├── playwright.config.ts # Playwright configuration
└── tsconfig.json        # TypeScript configuration
```
>>>>>>> 507923e (Add P2P file sharing implementation with WebRTC)

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later
- Redis (for production signaling server)

### Installation

#### Frontend Application

```bash
# Clone the repository
git clone https://github.com/your-username/quick-share-p2p.git
cd quick-share-p2p

# Install dependencies
npm install

# Create environment configuration
cp .env.example .env.local
```

Edit `.env.local` with your configuration:

```
NEXT_PUBLIC_SIGNALING_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=your-jwt-secret-key-here
```

#### Signaling Server

```bash
# Navigate to server directory
cd server

# Install server dependencies
npm install

# Create server environment configuration
cp .env.example .env
```

Edit the server `.env` file with your configuration:

```
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
ROOM_CODE_LENGTH=6
ROOM_EXPIRY_SECONDS=3600
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
REDIS_URL=redis://localhost:6379
```

### Running the Application

<<<<<<< HEAD
Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
=======
#### Development Mode

Start the frontend application:

```bash
# In the project root
npm run dev
```

Start the signaling server:

```bash
# In the server directory
npm run dev
```

The application will be available at http://localhost:3000 and the signaling server at http://localhost:3001.

#### Production Mode

Build and start the frontend application:

```bash
# In the project root
npm run build
npm start
```

Build and start the signaling server:

```bash
# In the server directory
npm run build
npm start
```

### Docker Deployment

Both the frontend and signaling server can be deployed using Docker:

```bash
# Build and run the frontend
docker build -t quick-share-frontend .
docker run -p 3000:3000 quick-share-frontend

# Build and run the signaling server
cd server
docker build -t quick-share-signaling .
docker run -p 3001:3001 quick-share-signaling
```

## User Guide

### Sharing Files

1. Visit the application at http://localhost:3000 (or your deployed URL)
2. Click "Send Files" or navigate to the send page
3. Drag and drop files or click to select files
4. The application will generate a secure 6-digit sharing code
5. Share this code with the recipient through any communication channel
6. Wait for the recipient to enter the code and establish connection
7. Once connected, the file transfer will begin automatically
8. You can pause, resume, or cancel the transfer at any time

### Receiving Files

1. Visit the application at http://localhost:3000 (or your deployed URL)
2. Click "Receive Files" or navigate to the receive page
3. Enter the 6-digit sharing code provided by the sender
4. Once the code is validated, a connection will be established
5. The file transfer will begin automatically
6. You can pause, resume, or cancel the transfer at any time
7. After the transfer completes, the file will be available for download

### Optional Authentication

1. Click "Sign In" to authenticate with Google
2. After authentication, you'll have access to:
   - Transfer history
   - User preferences
   - Saved contacts (if enabled)
3. Authentication is completely optional and not required for core functionality

## Troubleshooting

### Connection Issues

- **Problem**: Unable to establish P2P connection
- **Solution**: Ensure both browsers support WebRTC, try using a different network, or check firewall settings

### File Transfer Failures

- **Problem**: File transfer starts but fails to complete
- **Solution**: Try with smaller files first, ensure stable internet connection, check browser memory limits

### Encryption Errors

- **Problem**: "Encryption not supported" message
- **Solution**: Use a browser with Web Crypto API support (all modern browsers)

For more detailed troubleshooting, see [Browser Compatibility Documentation](docs/browser-compatibility.md).

## Browser Compatibility

Quick-Share P2P is designed to work across all modern browsers:

- **Desktop Browsers**: Chrome 80+, Firefox 78+, Safari 14.1+, Edge 80+
- **Mobile Browsers**: iOS Safari 14.1+, Chrome for Android, Firefox for Android

For detailed compatibility information and known limitations, see [Browser Compatibility Documentation](docs/browser-compatibility.md).

## Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e

# Run browser compatibility tests
npm run test:browser-compat

# Run accessibility tests
npm run test:accessibility
```

For detailed testing instructions, see [Browser Testing Guide](docs/browser-testing-guide.md).

## Security

This platform prioritizes security and privacy with:

- AES-256-GCM encryption for all file transfers
- PBKDF2 with SHA-256 for secure key derivation
- Zero server-side storage of files or encryption keys
- Forward secrecy with new keys for each session
- Minimal user data storage for authenticated users
- Privacy-compliant data handling

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.
>>>>>>> 507923e (Add P2P file sharing implementation with WebRTC)
