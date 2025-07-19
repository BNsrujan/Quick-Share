# API Reference

This document provides a comprehensive reference for the Quick-Share P2P platform's signaling server API endpoints and WebSocket events.

## REST API Endpoints

### Health Check

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

**Status Codes:**
- 200: Server is healthy
- 500: Server error

### Metrics

```
GET /health/metrics
```

Returns Prometheus-formatted metrics for monitoring.

**Response Format:** Prometheus text-based format

**Status Codes:**
- 200: Metrics retrieved successfully
- 500: Server error

### Create Room

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

### Join Room

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

### Validate Code

```
GET /api/rooms/validate/:code
```

Validates a room code without joining the room.

**Parameters:**
- `code`: The room code to validate

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

### Room Status

```
GET /api/rooms/:id
```

Gets the status of a room.

**Parameters:**
- `id`: The room ID

**Response:**

```json
{
  "id": "room-id",
  "status": "waiting",
  "expiresAt": "2023-07-17T12:00:00.000Z",
  "metadata": {
    "fileName": "example.txt",
    "fileSize": 1024,
    "fileType": "text/plain"
  }
}
```

**Status Codes:**
- 200: Room status retrieved successfully
- 404: Room not found
- 500: Server error

## WebSocket Events

The signaling server uses Socket.IO for real-time communication between peers.

### Connection

To connect to the WebSocket server:

```javascript
const socket = io('https://your-signaling-server.com', {
  transports: ['websocket'],
  query: {
    clientId: 'unique-client-id'
  }
});
```

### Client to Server Events

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

### Server to Client Events

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

## Error Handling

The API uses standard HTTP status codes and returns error responses in the following format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `INVALID_REQUEST` | The request body is invalid or missing required fields |
| `ROOM_NOT_FOUND` | The requested room does not exist or has expired |
| `ROOM_FULL` | The room already has the maximum number of peers |
| `INVALID_CODE` | The provided room code is invalid |
| `RATE_LIMITED` | Too many requests from this client |
| `SERVER_ERROR` | An unexpected server error occurred |

## Rate Limiting

The API implements rate limiting to prevent abuse. Rate limits are applied per client IP address and vary by endpoint:

| Endpoint | Default Limit |
|----------|---------------|
| Room creation | 10 per minute |
| Room joining | 20 per minute |
| Code validation | 30 per minute |
| WebSocket connections | 60 per minute |

When a rate limit is exceeded, the server returns a 429 Too Many Requests status code with a Retry-After header indicating when the client can retry.

## Authentication

The signaling server does not require authentication for basic functionality. However, if Google authentication is enabled in the frontend, authenticated users may have higher rate limits and additional features.

## Configuration

The API behavior can be configured through environment variables. See the [Installation Guide](installation-guide.md) for details on available configuration options.

## WebRTC Signaling Flow

The typical signaling flow for establishing a WebRTC connection is:

1. Sender creates a room via `POST /api/rooms`
2. Sender connects to WebSocket and joins the room via `join_room` event
3. Receiver validates the room code via `GET /api/rooms/validate/:code`
4. Receiver connects to WebSocket and joins the room via `join_room` event
5. Sender receives `peer_joined` event and creates a WebRTC offer
6. Sender sends the offer via `send_offer` event
7. Receiver receives the offer via `receive_offer` event
8. Receiver creates an answer and sends it via `send_answer` event
9. Sender receives the answer via `receive_answer` event
10. Both peers exchange ICE candidates via `send_ice_candidate` and `receive_ice_candidate` events
11. Once the WebRTC connection is established, file transfer occurs directly between peers
12. Transfer status updates are sent via WebSocket events for UI updates

## Example Usage

### Creating a Room

```javascript
// Create a room
const response = await fetch('https://signaling.example.com/api/rooms', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    metadata: {
      fileName: 'example.pdf',
      fileSize: 1024000,
      fileType: 'application/pdf'
    }
  })
});

const room = await response.json();
console.log(`Room created with code: ${room.code}`);
```

### Joining a Room

```javascript
// Join a room
const response = await fetch('https://signaling.example.com/api/rooms/join', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    code: 'ABC123',
    peerId: 'unique-peer-id'
  })
});

const room = await response.json();
console.log(`Joined room: ${room.id}`);
```

### WebSocket Connection

```javascript
// Connect to WebSocket
const socket = io('https://signaling.example.com', {
  transports: ['websocket']
});

// Join a room
socket.emit('join_room', {
  roomId: 'room-id',
  peerId: 'unique-peer-id'
});

// Listen for peer joining
socket.on('peer_joined', (data) => {
  console.log(`Peer ${data.peerId} joined room ${data.roomId}`);
  // Create and send WebRTC offer
});

// Send WebRTC offer
socket.emit('send_offer', {
  roomId: 'room-id',
  offer: rtcSessionDescription,
  senderId: 'unique-peer-id'
});

// Receive WebRTC answer
socket.on('receive_answer', (data) => {
  console.log(`Received answer from peer ${data.senderId}`);
  // Process the answer
});
```

## Security Considerations

- All API endpoints should be accessed over HTTPS
- WebSocket connections should use WSS (secure WebSockets)
- Room codes have sufficient entropy to prevent brute force attacks
- Rate limiting prevents abuse and DoS attacks
- The server never has access to file data or encryption keys
- Room state is automatically cleaned up after expiration

For more information on security features, see the [Security Architecture](security-architecture.md) document.