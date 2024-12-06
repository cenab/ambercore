# gRPC Client Library

A powerful and flexible gRPC client library for NestJS applications, supporting all gRPC call types with built-in error handling, retries, and TypeScript support.

## Features

- 🚀 Full support for all gRPC call types:
  - Unary calls (request/response)
  - Server streaming
  - Client streaming
  - Bidirectional streaming
- 🔄 Automatic retries with configurable backoff
- 🔒 SSL/TLS support
- 📝 Full TypeScript support with generated types
- 🎯 NestJS module integration
- 🔍 Detailed logging and debugging
- ⚡ Load balancing support
- 🗜️ Compression support
- 💪 Keepalive connection management

## Installation

```bash
npm install @grpc/grpc-js @grpc/proto-loader
```

## Usage

### Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { GrpcModule } from './grpc.module';
import { credentials } from '@grpc/grpc-js';

@Module({
  imports: [
    GrpcModule.forRoot({
      enabled: true,
      host: 'localhost',
      port: 50051,
      protoPath: './proto/service.proto',
      packageName: 'ambercore',
      serviceName: 'UserService',
      ssl: false,
      credentials: credentials.createInsecure(),
      maxMessageSize: 4 * 1024 * 1024, // 4MB
      keepaliveInterval: 30000,
      retryConfig: {
        attempts: 3,
        delay: 1000,
        maxDelay: 5000,
        timeout: 10000,
      },
    }),
  ],
})
export class AppModule {}
```

### Service Usage

```typescript
import { Injectable } from '@nestjs/common';
import { GrpcClient } from './grpc.client';

@Injectable()
export class UserService {
  constructor(private readonly grpcClient: GrpcClient) {}

  // Unary call example
  async getUser(id: string) {
    return this.grpcClient.unaryCall('GetUser', { id });
  }

  // Server streaming example
  listUsers(page: number, limit: number) {
    return this.grpcClient.serverStreamCall('ListUsers', { page, limit });
  }

  // Client streaming example
  async createUsers(users: any[]) {
    const stream = this.grpcClient.clientStreamCall('CreateUser');
    users.forEach(user => stream.write(user));
    return stream.complete();
  }

  // Bidirectional streaming example
  watchUserUpdates(userId: string) {
    const stream = this.grpcClient.bidiStreamCall('WatchUserUpdates');
    stream.write({ userId });
    return stream;
  }
}
```

### Proto Definition

```protobuf
syntax = "proto3";

package ambercore;

service UserService {
  rpc GetUser (GetUserRequest) returns (User) {}
  rpc ListUsers (ListUsersRequest) returns (ListUsersResponse) {}
  rpc CreateUser (CreateUserRequest) returns (User) {}
  rpc UpdateUser (UpdateUserRequest) returns (User) {}
  rpc DeleteUser (DeleteUserRequest) returns (DeleteUserResponse) {}
  rpc WatchUserUpdates (WatchUserRequest) returns (stream UserUpdate) {}
}

// Message definitions omitted for brevity...
```

## API Reference

### GrpcClient

#### Methods

##### `unaryCall<Request, Response>(method: string, request: Request, options?: GRPCCallOptions): Promise<Response>`
Makes a unary gRPC call (single request, single response).

##### `serverStreamCall<Request, Response>(method: string, request: Request, options?: GRPCCallOptions): Observable<Response>`
Makes a server streaming gRPC call (single request, multiple responses).

##### `clientStreamCall<Request, Response>(method: string, options?: GRPCCallOptions): GRPCClientStream<Request, Response>`
Makes a client streaming gRPC call (multiple requests, single response).

##### `bidiStreamCall<Request, Response>(method: string, options?: GRPCCallOptions): GRPCBidiStream<Request, Response>`
Makes a bidirectional streaming gRPC call (multiple requests, multiple responses).

### Configuration Options

```typescript
interface GRPCConfig {
  enabled?: boolean;
  debug?: boolean;
  host?: string;
  port?: number;
  protoPath?: string;
  packageName?: string;
  serviceName?: string;
  ssl?: boolean;
  credentials?: ChannelCredentials;
  maxMessageSize?: number;
  keepaliveInterval?: number;
  loadBalancing?: 'round_robin' | 'pick_first';
  compression?: boolean;
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

## Error Handling

The client includes comprehensive error handling:

```typescript
try {
  const user = await grpcClient.unaryCall('GetUser', { id: 'invalid' });
} catch (error) {
  if (error.code === 'NOT_FOUND') {
    // Handle not found error
  } else if (error.code === 'DEADLINE_EXCEEDED') {
    // Handle timeout error
  } else {
    // Handle other errors
  }
}
```

## Testing

The library includes comprehensive tests for all call types and error scenarios. Run tests with:

```bash
npm test src/libs/grpc/grpc.client.spec.ts
```

## Best Practices

1. **Error Handling**: Always implement proper error handling for each call type.
2. **Streaming**: Close streams when done to prevent memory leaks.
3. **Timeouts**: Set appropriate timeouts for your use case.
4. **SSL/TLS**: Use secure credentials in production.
5. **Message Size**: Configure maxMessageSize based on your payload requirements.
6. **Retries**: Configure retry settings based on your reliability needs.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 