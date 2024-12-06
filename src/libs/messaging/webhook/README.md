# Webhook Service

A powerful and flexible Webhook service for NestJS applications, supporting both incoming webhook handling and outgoing webhook delivery with signature verification, retries, and subscription management.

## Features

- 🚀 Bidirectional webhook support (incoming and outgoing)
- 🔒 Signature verification for security
- 🔄 Automatic retries with configurable backoff
- 📝 Full TypeScript support
- 🎯 NestJS module integration
- 🔍 Detailed logging and debugging
- ⚡ Subscription management
- 💪 Event-based handling
- 🎭 Comprehensive error handling
- ⏱️ Configurable timeouts

## Installation

No additional installation required - the library is part of the core package.

## Usage

### Module Configuration

```typescript
import { Module } from '@nestjs/common';
import { WebhookModule } from './webhook.module';

@Module({
  imports: [
    WebhookModule.forRoot({
      secret: 'your-webhook-secret',
      path: '/webhooks',
      port: 3000,
      verifySignature: true,
      endpoints: {
        userCreated: 'https://api.example.com/webhooks/user-created',
        orderCompleted: 'https://api.example.com/webhooks/order-completed',
      },
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': 'your-api-key',
      },
      timeout: 5000,
      retries: 3,
      retryDelay: 1000,
    }),
  ],
})
export class AppModule {}
```

### Controller Implementation

```typescript
import { Controller, Post, Body, Headers, Res } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { Response } from 'express';

@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhookService: WebhookService) {
    // Register webhook handlers
    this.webhookService.on('userCreated', async (event) => {
      console.log('User created:', event.data);
    });

    this.webhookService.on('orderCompleted', async (event) => {
      console.log('Order completed:', event.data);
    });
  }

  @Post()
  async handleWebhook(
    @Body() body: any,
    @Headers('x-webhook-signature') signature: string,
    @Res() response: Response
  ) {
    return this.webhookService.handleWebhook(
      { body, headers: { 'x-webhook-signature': signature } } as any,
      response
    );
  }

  // Method to send webhooks
  async sendWebhook(type: string, data: any) {
    const event = {
      id: Date.now().toString(),
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    return this.webhookService.deliver(type, event);
  }
}
```

### Subscription Management

```typescript
import { Injectable } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookSubscription } from './webhook.types';

@Injectable()
export class SubscriptionService {
  constructor(private readonly webhookService: WebhookService) {}

  async addSubscription(subscription: WebhookSubscription) {
    await this.webhookService.addSubscription(subscription);
  }

  async updateSubscription(id: string, subscription: WebhookSubscription) {
    await this.webhookService.updateSubscription(id, subscription);
  }

  async removeSubscription(id: string) {
    await this.webhookService.removeSubscription(id);
  }

  async broadcastEvent(event: WebhookEvent) {
    await this.webhookService.broadcast(event);
  }
}
```

## API Reference

### WebhookService

#### Methods

##### `handleWebhook(request: Request, response: Response): Promise<void>`
Handles incoming webhooks with signature verification.

##### `deliver(type: string, event: WebhookEvent): Promise<WebhookDeliveryResult>`
Delivers a webhook to a configured endpoint with retries.

##### `broadcast(event: WebhookEvent): Promise<void>`
Broadcasts an event to all active subscriptions.

##### `on(type: string, handler: (event: WebhookEvent) => Promise<void>): void`
Registers a handler for a specific webhook type.

##### `addSubscription(subscription: WebhookSubscription): Promise<void>`
Adds a new webhook subscription.

##### `updateSubscription(id: string, subscription: WebhookSubscription): Promise<void>`
Updates an existing webhook subscription.

##### `removeSubscription(id: string): Promise<void>`
Removes a webhook subscription.

### Configuration Options

```typescript
interface WebhookConfig {
  secret?: string;
  path?: string;
  port?: number;
  verifySignature?: boolean;
  endpoints?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

interface WebhookEvent<T = any> {
  id: string;
  type: string;
  data: T;
  timestamp: string;
  signature?: string;
}

interface WebhookSubscription {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  lastDelivery?: {
    timestamp: string;
    success: boolean;
    statusCode?: number;
  };
}
```

## Security

### Signature Verification

Incoming webhooks are verified using HMAC-SHA256:

```typescript
const signature = crypto
  .createHmac('sha256', webhookSecret)
  .update(JSON.stringify(payload))
  .digest('hex');
```

### Best Practices

1. Always use HTTPS endpoints
2. Keep webhook secrets secure
3. Implement proper error handling
4. Set appropriate timeouts
5. Use signature verification
6. Monitor webhook deliveries
7. Implement idempotency

## Error Handling

The service includes comprehensive error handling:

```typescript
try {
  const result = await webhookService.deliver('userCreated', event);
  if (!result.success) {
    console.error('Webhook delivery failed:', result.error);
    if (result.statusCode === 408) {
      // Handle timeout
    } else if (result.statusCode === 401) {
      // Handle authentication error
    }
  }
} catch (error) {
  // Handle unexpected errors
}
```

## Testing

The library includes comprehensive tests for all functionality. Run tests with:

```bash
npm test src/libs/webhook/webhook.service.spec.ts
```

## Performance Considerations

1. **Timeouts**: Set appropriate timeouts to prevent hanging connections
2. **Retries**: Configure retry attempts and delays based on your needs
3. **Payload Size**: Keep webhook payloads reasonably sized
4. **Rate Limiting**: Implement rate limiting for outgoing webhooks
5. **Batch Processing**: Consider batching multiple events when possible

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 