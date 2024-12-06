# WebSocket Service

A robust and scalable WebSocket service for NestJS applications, built on Socket.IO with Redis-backed state management for distributed environments.

## Features

- 🚀 Real-time bidirectional communication
- 🔄 Automatic reconnection handling
- 🏠 Room-based messaging
- 👥 Client tracking and management
- 📦 Redis-backed state management
- 🔍 Debug mode with detailed logging
- ⚡ Event-based architecture
- 🎯 Direct messaging support
- 🔒 Authentication and authorization
- 💪 Scalable for distributed systems

## Installation

No additional installation required - the library is part of the core package.

## Usage

### Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { WebSocketModule } from './websocket.module';

@Module({
  imports: [
    WebSocketModule.forRoot({
      enabled: true,
      debug: false,
      path: '/socket.io',
      port: 3000,
      transports: ['websocket', 'polling'],
      pingInterval: 25000,
      pingTimeout: 5000,
      maxConnections: 1000,
      ssl: false,
      keepAlive: true,
      retryConfig: {
        attempts: 3,
        delay: 1000,
        maxDelay: 5000,
        timeout: 10000,
      },
      logger: {
        level: 'info',
        pretty: true,
      },
    }),
  ],
})
export class AppModule {}
```

### Gateway Implementation

```typescript
import { WebSocketGateway, SubscribeMessage } from '@nestjs/websockets';
import { WebSocketService } from './websocket.service';
import { Socket } from 'socket.io';

@WebSocketGateway()
export class ChatGateway {
  constructor(private readonly websocketService: WebSocketService) {}

  @SubscribeMessage('join-room')
  async handleJoinRoom(client: Socket, room: string) {
    await this.websocketService.joinRoom(client, room);
    await this.websocketService.broadcastToRoom(room, 'user-joined', {
      userId: client.id,
      room,
    });
  }

  @SubscribeMessage('leave-room')
  async handleLeaveRoom(client: Socket, room: string) {
    await this.websocketService.leaveRoom(client, room);
    await this.websocketService.broadcastToRoom(room, 'user-left', {
      userId: client.id,
      room,
    });
  }

  @SubscribeMessage('send-message')
  async handleMessage(client: Socket, payload: any) {
    await this.websocketService.broadcastToRoom(payload.room, 'new-message', {
      userId: client.id,
      message: payload.message,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Client Usage

```typescript
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  transports: ['websocket'],
  autoConnect: true,
});

// Join a room
socket.emit('join-room', 'room-1');

// Listen for new messages
socket.on('new-message', (data) => {
  console.log(`New message from ${data.userId}: ${data.message}`);
});

// Send a message
socket.emit('send-message', {
  room: 'room-1',
  message: 'Hello everyone!',
});

// Leave a room
socket.emit('leave-room', 'room-1');
```

## API Reference

### WebSocketService

#### Methods

##### `handleConnection(client: Socket): Promise<void>`
Handles new client connections and initializes client state.

##### `handleDisconnect(client: Socket): Promise<void>`
Handles client disconnections and cleans up resources.

##### `joinRoom(client: Socket, room: string): Promise<void>`
Adds a client to a room and updates room state.

##### `leaveRoom(client: Socket, room: string): Promise<void>`
Removes a client from a room and updates room state.

##### `broadcastToRoom(room: string, event: string, data: any): Promise<void>`
Broadcasts a message to all clients in a room.

##### `sendToClient(clientId: string, event: string, data: any): Promise<void>`
Sends a message to a specific client.

##### `broadcast(event: string, data: any): Promise<void>`
Broadcasts a message to all connected clients.

### Configuration Options

```typescript
interface WebSocketConfig {
  enabled?: boolean;
  debug?: boolean;
  path?: string;
  port?: number;
  transports?: ('websocket' | 'polling')[];
  pingInterval?: number;
  pingTimeout?: number;
  maxConnections?: number;
  ssl?: boolean;
  keepAlive?: boolean;
  retryConfig?: {
    attempts?: number;
    delay?: number;
    maxDelay?: number;
    timeout?: number;
  };
  logger?: {
    level: 'error' | 'warn' | 'info' | 'debug';
    pretty?: boolean;
  };
}
```

## State Management

The service uses Redis for state management, making it suitable for distributed environments:

```typescript
// Client state in Redis
interface WebSocketClient {
  id: string;
  rooms: string[];
  metadata?: Record<string, any>;
  connectedAt: string;
  lastActiveAt: string;
}

// Room state in Redis
interface WebSocketRoom {
  id: string;
  name: string;
  clients: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}
```

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  await websocketService.joinRoom(client, room);
} catch (error) {
  if (error.code === 'ROOM_FULL') {
    client.emit('error', { message: 'Room is full' });
  } else if (error.code === 'ROOM_CLOSED') {
    client.emit('error', { message: 'Room is closed' });
  } else {
    client.emit('error', { message: 'Failed to join room' });
  }
}
```

## Testing

The library includes comprehensive tests. Run them with:

```bash
npm test src/libs/websocket/websocket.service.spec.ts
```

## Performance Considerations

1. **Connection Pooling**: Use Redis connection pooling for better performance
2. **Message Size**: Keep message payloads small and efficient
3. **Room Management**: Clean up empty rooms and inactive clients
4. **Event Handlers**: Use debouncing for high-frequency events
5. **Memory Management**: Monitor memory usage and implement cleanup strategies

## Scaling

The service is designed for horizontal scaling:

1. **Redis Pub/Sub**: Enables cross-instance communication
2. **State Management**: Distributed state via Redis
3. **Load Balancing**: Supports sticky sessions
4. **Room Sharding**: Distribute rooms across instances
5. **Client Tracking**: Track clients across instances

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 