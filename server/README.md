# Quick-Share P2P Signaling Server

This is the signaling server for the Quick-Share P2P platform. It facilitates WebRTC connections between peers for direct file transfers without storing any file data or encryption keys.

## Features

- Room creation and management with secure code generation
- WebRTC signaling relay for offer/answer/ICE candidate exchange
- Rate limiting and abuse prevention
- Room expiration and cleanup
- Redis-based state management
- WebSocket support for real-time communication
- Metrics collection for monitoring
- Health check endpoints

## Architecture

The signaling server uses:

- **Express.js**: For HTTP API endpoints
- **Socket.IO**: For WebSocket communication
- **Redis**: For state management and rate limiting
- **Winston**: For structured logging
- **Prometheus**: For metrics collection

```
┌─────────────────┐
│ Signaling Server│
│                 │
│ ┌─────────────┐ │
│ │ Express API │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ Socket.IO   │ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ Room Manager│ │
│ └─────────────┘ │
│ ┌─────────────┐ │
│ │ Rate Limiter│ │
│ └─────────────┘ │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Redis           │
│ - Room State    │
│ - Rate Limits   │
└─────────────────┘
```

## Prerequisites

- Node.js 18+
- npm 9+
- Redis server (optional for development, recommended for production)

## Setup

### Installation

1. Install dependencies:

```bash
npm install
```

2. Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

3. Update the `.env` file with your configuration:

```
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
ROOM_CODE_LENGTH=6
ROOM_EXPIRY_SECONDS=3600
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
REDIS_URL=redis://localhost:6379
REDIS_ENABLED=true
LOG_LEVEL=info
LOG_FORMAT=dev
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| PORT | Server port | 3001 |
| NODE_ENV | Environment (development/production) | development |
| CORS_ORIGIN | Allowed CORS origin | http://localhost:3000 |
| ROOM_CODE_LENGTH | Length of generated room codes | 6 |
| ROOM_EXPIRY_SECONDS | Room expiration time in seconds | 3600 |
| RATE_LIMIT_WINDOW_MS | Rate limiting window in milliseconds | 60000 |
| RATE_LIMIT_MAX_REQUESTS | Maximum requests per window | 100 |
| REDIS_URL | Redis connection string | redis://localhost:6379 |
| REDIS_ENABLED | Enable Redis (use in-memory if false) | true |
| LOG_LEVEL | Logging level | info |
| LOG_FORMAT | Log format (dev/json) | dev |

## Development

Run the server in development mode:

```bash
npm run dev
```

The server will be available at http://localhost:3001 with hot reloading enabled.

## Production

Build the server:

```bash
npm run build
```

Start the server:

```bash
npm run start
```

## Docker

Build and run with Docker:

```bash
docker build -t quick-share-signaling .
docker run -p 3001:3001 --env-file .env quick-share-signaling
```

## Testing

Run tests:

```bash
npm test
```

Run tests with coverage:

```bash
npm run test:coverage
```

## API Reference

### HTTP Endpoints

#### Health Check

```
GET /health
```

Returns the server status and basic metrics.

**Response:**

```json
{
  "status": "ok",
  "uptime": 123456,
  "timestamp": "2023-07-17T12:00:00.000Z",
  "version": "1.0.0",
  "activeRooms": 5,
  "activeSockets": 10
}
```

#### Metrics

```
GET /health/metrics
```

Returns Prometheus-formatted metrics.

#### Create Room

```
POST /api/rooms
```

Creates a new room for file sharing.

**Request Body:**

```json
{
  "metadata": {
    "fileName": "example.txt",
    "fileSize": 1024,
    "fileType": "text/plain"
  }
}
```

**Response:**

```json
{
  "id": "room-id",
  "code": "ABC123",
  "expiresAt": "2023-07-17T12:00:00.000Z"
}
```

**Status Codes:**

- 201: Room created successfully
- 400: Invalid request body
- 429: Too many requests (rate limited)
- 500: Server error

#### Join Room

```
POST /api/rooms/join
```

Joins an existing room using a code.

**Request Body:**

```json
{
  "code": "ABC123",
  "peerId": "peer-id"
}
```

**Response:**

```json
{
  "id": "room-id",
  "status": "connected",
  "metadata": {
    "fileName": "example.txt",
    "fileSize": 1024,
    "fileType": "text/plain"
  }
}
```

**Status Codes:**

- 200: Joined room successfully
- 400: Invalid request body
- 404: Room not found
- 409: Room already has two peers
- 429: Too many requests (rate limited)
- 500: Server error

#### Validate Code

```
GET /api/rooms/validate/:code
```

Validates a room code.

**Response:**

```json
{
  "valid": true
}
```

**Status Codes:**

- 200: Code validation result
- 429: Too many requests (rate limited)
- 500: Server error

### WebSocket Events

The signaling server uses Socket.IO for real-time communication between peers.

#### Client to Server Events

| Event | Description | Payload |
|-------|-------------|---------|
| `join_room` | Join a room | `{ roomId: string, peerId: string }` |
| `leave_room` | Leave a room | `{ roomId: string, peerId: string }` |
| `send_offer` | Send WebRTC offer | `{ roomId: string, offer: RTCSessionDescription, senderId: string }` |
| `send_answer` | Send WebRTC answer | `{ roomId: string, answer: RTCSessionDescription, senderId: string }` |
| `send_ice_candidate` | Send ICE candidate | `{ roomId: string, candidate: RTCIceCandidate, senderId: string }` |
| `transfer_started` | Notify transfer started | `{ roomId: string, senderId: string }` |
| `transfer_progress` | Update transfer progress | `{ roomId: string, senderId: string, progress: number }` |
| `transfer_paused` | Notify transfer paused | `{ roomId: string, senderId: string }` |
| `transfer_resumed` | Notify transfer resumed | `{ roomId: string, senderId: string }` |
| `transfer_completed` | Notify transfer completed | `{ roomId: string, senderId: string }` |
| `transfer_cancelled` | Notify transfer cancelled | `{ roomId: string, senderId: string, reason?: string }` |

#### Server to Client Events

| Event | Description | Payload |
|-------|-------------|---------|
| `room_joined` | Room joined successfully | `{ roomId: string, status: string }` |
| `room_left` | Left room successfully | `{ roomId: string }` |
| `room_error` | Error with room operation | `{ error: string, roomId?: string }` |
| `receive_offer` | Received WebRTC offer | `{ roomId: string, offer: RTCSessionDescription, senderId: string }` |
| `receive_answer` | Received WebRTC answer | `{ roomId: string, answer: RTCSessionDescription, senderId: string }` |
| `receive_ice_candidate` | Received ICE candidate | `{ roomId: string, candidate: RTCIceCandidate, senderId: string }` |
| `peer_joined` | Another peer joined the room | `{ roomId: string, peerId: string }` |
| `peer_left` | A peer left the room | `{ roomId: string, peerId: string }` |
| `transfer_started` | Transfer started | `{ roomId: string, senderId: string }` |
| `transfer_progress` | Transfer progress update | `{ roomId: string, senderId: string, progress: number }` |
| `transfer_paused` | Transfer paused | `{ roomId: string, senderId: string }` |
| `transfer_resumed` | Transfer resumed | `{ roomId: string, senderId: string }` |
| `transfer_completed` | Transfer completed | `{ roomId: string, senderId: string }` |
| `transfer_cancelled` | Transfer cancelled | `{ roomId: string, senderId: string, reason?: string }` |
| `transfer_error` | Error with transfer | `{ roomId: string, error: string }` |

## Data Models

### Room Model

```typescript
interface Room {
  id: string;
  code: string;
  createdAt: Date;
  expiresAt: Date;
  status: 'waiting' | 'connected' | 'transferring' | 'completed';
  peers: {
    sender?: {
      id: string;
      connectedAt?: Date;
    };
    receiver?: {
      id: string;
      connectedAt?: Date;
    };
  };
  metadata: {
    fileName: string;
    fileSize: number;
    fileType: string;
  };
}
```

## Security Features

- **Rate limiting**: Prevents abuse by limiting requests per IP
- **Secure random code generation**: Uses cryptographically secure random number generation
- **Room expiration**: Rooms automatically expire after a configurable time
- **No file storage**: The server never stores or processes file data
- **CORS protection**: Restricts origins that can access the API
- **Helmet**: Adds HTTP security headers

## Monitoring and Metrics

The server exposes Prometheus metrics at `/health/metrics` including:

- Active rooms count
- Active WebSocket connections
- Request latency
- Error rates
- Room creation/join rates

## Deployment

For detailed deployment instructions, see the [Deployment Guide](../docs/deployment-guide.md).

### Kubernetes

Kubernetes manifests are provided in the `deploy/kubernetes` directory:

- `namespace.yaml`: Creates the Kubernetes namespace
- `configmap.yaml`: ConfigMap for environment variables
- `secret.yaml`: Secret for sensitive configuration
- `deployment.yaml`: Deployment configuration
- `service.yaml`: Service configuration
- `ingress.yaml`: Ingress configuration

### Docker Compose

A Docker Compose configuration is available for simpler deployments:

```yaml
version: '3'

services:
  signaling:
    build: .
    ports:
      - "3001:3001"
    environment:
      - PORT=3001
      - NODE_ENV=production
      - CORS_ORIGIN=https://your-frontend-domain.com
      - REDIS_URL=redis://redis:6379
    depends_on:
      - redis
    restart: unless-stopped

  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the LICENSE file for details.