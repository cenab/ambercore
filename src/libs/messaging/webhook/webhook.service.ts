import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { createHmac } from 'crypto';
import { Request, Response } from 'express';
import express from 'express';
import {
  WebhookConfig,
  WebhookEvent,
  WebhookHandler,
  WebhookDeliveryResult,
  WebhookDeliveryOptions,
  WebhookSubscription,
  WebhookSignatureOptions,
} from './webhook.types';

@Injectable()
export class WebhookService implements OnModuleInit, OnModuleDestroy {
  private readonly handlers: Map<string, WebhookHandler> = new Map();
  private readonly subscriptions: Map<string, WebhookSubscription> = new Map();
  private server: any;
  private readonly logger = new Logger(WebhookService.name);

  constructor(private readonly config: WebhookConfig) {}

  onModuleInit() {
    if (this.config.path) {
      this.startServer();
    }
  }

  onModuleDestroy() {
    if (this.server) {
      this.server.close();
    }
  }

  private startServer() {
    try {
      const app = express();
      app.use(express.json());

      app.post(this.config.path!, async (req: Request, res: Response) => {
        try {
          const event = req.body as WebhookEvent;
          const handler = this.handlers.get(event.type);

          if (!handler) {
            res.status(404).json({ error: 'No handler found for event type' });
            return;
          }

          if (handler.verifySignature !== false && this.config.verifySignature) {
            const isValid = this.verifySignature(req);
            if (!isValid) {
              res.status(401).json({ error: 'Invalid signature' });
              return;
            }
          }

          await handler.handler(event, req, res);
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      });

      this.server = app.listen(this.config.port || 3000);
    } catch (error) {
      this.logger.error('Failed to initialize webhook server:', error);
    }
  }

  private verifySignature(req: Request): boolean {
    if (!this.config.verifySignature || !this.config.secret) return true;

    const signature = req.headers['x-webhook-signature'] as string;
    if (!signature) return false;

    const hmac = createHmac('sha256', this.config.secret);
    hmac.update(JSON.stringify(req.body));
    const computedSignature = hmac.digest('hex');

    return signature === computedSignature;
  }

  private generateSignature(payload: any, options?: WebhookSignatureOptions): string {
    if (!this.config.secret) return '';

    const algorithm = options?.algorithm || 'sha256';
    const hmac = createHmac(algorithm, this.config.secret);
    hmac.update(JSON.stringify(payload));
    const signature = hmac.digest('hex');
    return options?.prefix ? `${options.prefix}${signature}` : signature;
  }

  private async deliverWebhook(
    url: string,
    event: WebhookEvent,
    options?: WebhookDeliveryOptions
  ): Promise<WebhookDeliveryResult> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.config.headers,
      ...options?.headers,
    };

    if (this.config.secret) {
      headers['x-webhook-signature'] = this.generateSignature(event);
    }

    const retries = options?.retries ?? this.config.retries ?? 3;
    const retryDelay = options?.retryDelay ?? this.config.retryDelay ?? 1000;
    const timeout = options?.timeout ?? this.config.timeout ?? 5000;

    let lastError: Error | undefined;
    let attemptCount = 0;

    while (attemptCount < retries) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          controller.abort();
        }, timeout);

        try {
          const response = await fetch(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(event),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);

          const result: WebhookDeliveryResult = {
            success: response.ok,
            statusCode: response.status,
            response: await response.json(),
            retries: attemptCount,
            timestamp: new Date().toISOString(),
          };

          if (!response.ok) {
            result.error = `HTTP ${response.status}: ${response.statusText}`;
          }

          return result;
        } catch (error) {
          clearTimeout(timeoutId);
          if (error.name === 'AbortError') {
            return {
              success: false,
              error: 'Request timed out',
              retries: attemptCount,
              timestamp: new Date().toISOString(),
            };
          }
          throw error;
        }
      } catch (error) {
        lastError = error;
      }

      attemptCount++;
      if (attemptCount < retries) {
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    return {
      success: false,
      error: lastError?.message,
      retries: attemptCount,
      timestamp: new Date().toISOString(),
    };
  }

  registerHandler<T = any>(handler: WebhookHandler<T>): void {
    this.handlers.set(handler.type, handler);
  }

  unregisterHandler(type: string): void {
    this.handlers.delete(type);
  }

  async send<T = any>(
    type: string,
    data: T,
    options?: WebhookDeliveryOptions
  ): Promise<WebhookDeliveryResult[]> {
    const event: WebhookEvent<T> = {
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type,
      data,
      timestamp: new Date().toISOString(),
    };

    const results: WebhookDeliveryResult[] = [];
    const subscriptions = Array.from(this.subscriptions.values())
      .filter(sub => sub.active && sub.events.includes(type));

    for (const subscription of subscriptions) {
      const result = await this.deliverWebhook(subscription.url, event, options);
      
      subscription.lastDelivery = {
        timestamp: result.timestamp,
        success: result.success,
        statusCode: result.statusCode,
      };

      results.push(result);
    }

    return results;
  }

  subscribe(url: string, events: string[]): WebhookSubscription {
    const subscription: WebhookSubscription = {
      id: `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      url,
      events,
      active: true,
      createdAt: new Date().toISOString(),
    };

    this.subscriptions.set(subscription.id, subscription);
    return subscription;
  }

  unsubscribe(subscriptionId: string): void {
    this.subscriptions.delete(subscriptionId);
  }

  getSubscription(subscriptionId: string): WebhookSubscription | undefined {
    return this.subscriptions.get(subscriptionId);
  }

  getSubscriptions(): WebhookSubscription[] {
    return Array.from(this.subscriptions.values());
  }

  updateSubscription(
    subscriptionId: string,
    updates: Partial<WebhookSubscription>
  ): WebhookSubscription | undefined {
    const subscription = this.subscriptions.get(subscriptionId);
    if (!subscription) return undefined;

    const updated = { ...subscription, ...updates };
    this.subscriptions.set(subscriptionId, updated);
    return updated;
  }
} 