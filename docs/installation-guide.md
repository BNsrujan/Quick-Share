# Installation and Setup Guide

This guide provides detailed instructions for setting up the Quick-Share P2P platform for local development, testing, and production deployment.

## Local Development Environment

### Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js**: Version 18.x or later
  - Download from [nodejs.org](https://nodejs.org/)
  - Verify with `node --version`
- **npm**: Version 9.x or later (comes with Node.js)
  - Verify with `npm --version`
- **Git**: For version control
  - Download from [git-scm.com](https://git-scm.com/)
  - Verify with `git --version`
- **Redis**: For signaling server (optional for development, required for production)
  - Download from [redis.io](https://redis.io/download)
  - Verify with `redis-cli --version`

### Frontend Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/your-username/quick-share-p2p.git
   cd quick-share-p2p
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure environment variables**:
   ```bash
   cp .env.example .env.local
   ```

4. **Edit `.env.local`** with your configuration:
   ```
   NEXT_PUBLIC_SIGNALING_URL=http://localhost:3001
   NEXT_PUBLIC_APP_URL=http://localhost:3000
   NEXTAUTH_URL=http://localhost:3000
   NEXTAUTH_SECRET=your-nextauth-secret-key-here
   GOOGLE_CLIENT_ID=your-google-client-id
   GOOGLE_CLIENT_SECRET=your-google-client-secret
   JWT_SECRET=your-jwt-secret-key-here
   ```

   > **Note**: For Google authentication, you'll need to create OAuth credentials in the Google Cloud Console. This is optional and not required for core functionality.

5. **Start the development server**:
   ```bash
   npm run dev
   ```

6. **Access the application**:
   Open your browser and navigate to http://localhost:3000

### Signaling Server Setup

1. **Navigate to the server directory**:
   ```bash
   cd server
   ```

2. **Install server dependencies**:
   ```bash
   npm install
   ```

3. **Configure server environment variables**:
   ```bash
   cp .env.example .env
   ```

4. **Edit `.env`** with your configuration:
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

   > **Note**: For development, you can set `REDIS_ENABLED=false` to use in-memory storage instead of Redis.

5. **Start the signaling server**:
   ```bash
   npm run dev
   ```

6. **Verify the server is running**:
   Open your browser and navigate to http://localhost:3001/health

## Setting Up Google OAuth (Optional)

If you want to enable Google authentication:

1. **Go to the [Google Cloud Console](https://console.cloud.google.com/)**
2. **Create a new project** or select an existing one
3. **Navigate to "APIs & Services" > "Credentials"**
4. **Click "Create Credentials" > "OAuth client ID"**
5. **Select "Web application"** as the application type
6. **Add your domain** to "Authorized JavaScript origins" (e.g., `http://localhost:3000` for development)
7. **Add your callback URL** to "Authorized redirect URIs" (e.g., `http://localhost:3000/api/auth/callback/google`)
8. **Copy the Client ID and Client Secret**
9. **Update your `.env.local`** file with these credentials

## Development Tools

### Code Linting and Formatting

The project uses ESLint and Prettier for code quality and formatting:

```bash
# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Format code with Prettier
npm run format
```

### Testing

The project includes comprehensive testing tools:

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage

# Run E2E tests with Playwright
npm run test:e2e

# Run browser compatibility tests
npm run test:browser-compat

# Run accessibility tests
npm run test:accessibility
```

### Building for Production

```bash
# Build the frontend application
npm run build

# Build the signaling server
cd server
npm run build
```

## Troubleshooting Development Issues

### Common Issues and Solutions

#### WebRTC Connection Failures

- **Issue**: Peers cannot establish a connection
- **Solution**: 
  - Ensure both browsers support WebRTC
  - Check that the signaling server is running
  - Verify CORS settings in the server's `.env` file
  - Try using a different network or check firewall settings

#### Next.js Build Errors

- **Issue**: Build fails with module resolution errors
- **Solution**:
  - Clear the `.next` cache directory: `rm -rf .next`
  - Ensure all dependencies are installed: `npm install`
  - Check for TypeScript errors: `npm run type-check`

#### Redis Connection Issues

- **Issue**: Server fails to connect to Redis
- **Solution**:
  - Verify Redis is running: `redis-cli ping`
  - Check Redis connection string in `.env`
  - For development, set `REDIS_ENABLED=false` to use in-memory storage

#### Authentication Problems

- **Issue**: Google authentication fails
- **Solution**:
  - Verify OAuth credentials in `.env.local`
  - Ensure redirect URIs match exactly in Google Cloud Console
  - Check browser console for specific error messages

## Next Steps

After setting up your development environment:

1. Explore the codebase to understand the architecture
2. Run the tests to ensure everything is working correctly
3. Try making small changes to get familiar with the system
4. Check out the [Browser Testing Guide](browser-testing-guide.md) for testing across different browsers
5. Review the [Browser Compatibility Documentation](browser-compatibility.md) for known limitations

For deployment instructions, see the [Deployment Guide](deployment-guide.md).