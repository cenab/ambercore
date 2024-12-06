# Server-Sent Events (SSE) Service

A powerful and flexible Server-Sent Events (SSE) service for NestJS applications, supporting real-time server-to-client communication with topic-based pub/sub, heartbeats, and automatic reconnection.

## Features

- 🚀 Real-time server-to-client communication
- 🔄 Topic-based pub/sub system
- 💓 Automatic heartbeat mechanism
- 🔁 Configurable retry intervals
- 📝 Full TypeScript support
- 🎯 NestJS module integration
- 🔍 Detailed logging and debugging
- 🗜️ Optional compression support
- 💪 Client connection management
- 🎭 Comprehensive error handling

## Installation

No additional installation required - the library is part of the core package.

## Usage

### Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { SSEModule } from './sse.module';

@Module({
  imports: [
    SSEModule.forRoot({
      enabled: true,
      heartbeatInterval: 30000,
      retryInterval: 3000,
      maxEventSize: 1024 * 1024, // 1MB
      compression: false,
      maxClients: 1000,
    }),
  ],
})
export class AppModule {}
```

### Controller Implementation

```typescript
import { Controller, Sse, Param } from '@nestjs/common';
import { SSEService } from './sse.service';
import { Response } from 'express';

@Controller('events')
export class EventsController {
  constructor(private readonly sseService: SSEService) {}

  @Sse('subscribe/:topic')
  async subscribe(@Param('topic') topic: string, response: Response) {
    const clientId = this.sseService.createClient(response);
    this.sseService.subscribe(clientId, topic);
    this.sseService.startHeartbeat(clientId);

    // Handle client disconnection
    response.on('close', () => {
      this.sseService.removeClient(clientId);
    });
  }

  // Method to send events to specific topics
  async sendEvent(topic: string, data: any) {
    this.sseService.broadcast({
      id: Date.now().toString(),
      event: 'message',
      data,
      topic,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### Client Implementation

```typescript
// Connect to SSE endpoint
const eventSource = new EventSource('/events/subscribe/my-topic');

// Handle connection open
eventSource.onopen = () => {
  console.log('SSE connection established');
};

// Handle messages
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Received:', data);
};

// Handle specific event types
eventSource.addEventListener('custom-event', (event) => {
  const data = JSON.parse(event.data);
  console.log('Custom event:', data);
});

// Handle errors
eventSource.onerror = (error) => {
  console.error('SSE error:', error);
};

// Close connection when done
function cleanup() {
  eventSource.close();
}
```

## API Reference

### SSEService

#### Methods

##### `createClient(response: Response): string`
Creates a new SSE client connection and returns the client ID.

##### `removeClient(clientId: string): void`
Removes a client connection and cleans up resources.

##### `subscribe(clientId: string, topic: string): void`
Subscribes a client to a specific topic.

##### `unsubscribe(clientId: string, topic: string): void`
Unsubscribes a client from a specific topic.

##### `sendEvent(clientId: string, event: SSEEvent): void`
Sends an event to a specific client.

##### `broadcast(event: SSEEvent): void`
Broadcasts an event to all clients subscribed to the event's topic.

##### `startHeartbeat(clientId: string): void`
Starts sending heartbeat events to a client.

### Configuration Options

```typescript
interface SSEConfig {
  enabled?: boolean;
  debug?: boolean;
  heartbeatInterval?: number;
  retryInterval?: number;
  maxEventSize?: number;
  compression?: boolean;
  maxClients?: number;
}

interface SSEEvent<T = any> {
  id?: string;
  event?: string;
  data: T;
  retry?: number;
  comment?: string;
  topic?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

interface SSEClient {
  id: string;
  response: Response;
  topics: Set<string>;
  metadata?: Record<string, any>;
  connectedAt: string;
  lastEventId?: string;
  lastEventAt: string;
  lastHeartbeatAt: string;
}
```

## Event Format

SSE events follow the standard format:

```
id: 1234
event: message
data: {"key": "value"}
retry: 3000

```

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  sseService.sendEvent(clientId, {
    data: { message: 'Test' },
  });
} catch (error) {
  if (error.code === 'CLIENT_NOT_FOUND') {
    // Handle missing client
  } else if (error.code === 'SEND_ERROR') {
    // Handle send error
  } else {
    // Handle other errors
  }
}
```

## Testing

The library includes comprehensive tests for all functionality. Run tests with:

```bash
npm test src/libs/sse/sse.service.spec.ts
```

## Best Practices

1. **Connection Management**: Always handle client disconnections properly.
2. **Heartbeats**: Use heartbeats to detect stale connections.
3. **Retry Intervals**: Configure appropriate retry intervals for your use case.
4. **Event Size**: Keep event payloads small to prevent performance issues.
5. **Topic Design**: Design topics hierarchically for better organization.
6. **Error Handling**: Implement proper error handling on both server and client.
7. **Cleanup**: Always clean up resources when connections are closed.

## Performance Considerations

1. **Memory Usage**: Monitor client connections and implement cleanup.
2. **Event Size**: Use compression for large payloads.
3. **Broadcast**: Be mindful of broadcasting to many clients.
4. **Heartbeat Interval**: Balance between connection stability and server load.
5. **Client Limit**: Set appropriate max client limits.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 