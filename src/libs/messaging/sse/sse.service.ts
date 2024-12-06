import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Response } from 'express';
import { SSEConfig, SSEClient, SSEEvent, SSESubscription } from './sse.types';

@Injectable()
export class SSEService implements OnModuleInit, OnModuleDestroy {
  private readonly clients = new Map<string, SSEClient>();
  private readonly subscriptions = new Map<string, SSESubscription>();
  private heartbeatInterval?: NodeJS.Timeout;
  private readonly logger = new Logger(SSEService.name);
  private readonly activeTopics = new Set<string>();

  constructor(private readonly config: SSEConfig = {}) {
    this.config = {
      enabled: true,
      debug: false,
      heartbeatInterval: 30000,
      retryInterval: 3000,
      maxClients: 1000,
      maxEventSize: 1024 * 1024, // 1MB
      compression: false,
      retryAfter: 5000,
      ...config,
    };
  }

  async onModuleInit() {
    if (!this.config.enabled) {
      this.logger.warn('SSE service is disabled');
      return;
    }

    try {
      await this.startHeartbeat();
      this.logger.log('SSE service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize SSE service:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    try {
      await this.cleanup();
      this.logger.log('SSE service cleaned up successfully');
    } catch (error) {
      this.logger.error('Failed to cleanup SSE service:', error);
    }
  }

  private async startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const now = new Date().toISOString();
      this.clients.forEach(client => {
        try {
          this.sendEvent(client, {
            id: 'heartbeat',
            event: 'heartbeat',
            data: now,
            timestamp: now,
          });
          client.lastHeartbeatAt = now;
        } catch (error) {
          this.logger.error(`Failed to send heartbeat to client ${client.id}:`, error);
          this.removeClient(client.id);
        }
      });
    }, this.config.heartbeatInterval);
  }

  private async cleanup() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      try {
        await this.removeClient(client.id);
      } catch (error) {
        this.logger.error(`Failed to remove client ${client.id}:`, error);
      }
    }

    this.clients.clear();
    this.subscriptions.clear();
    this.activeTopics.clear();
  }

  addClient(response: Response, topics: string[] = []): string {
    if (!this.config.enabled) {
      throw new Error('SSE service is disabled');
    }

    if (this.clients.size >= this.config.maxClients!) {
      throw new Error('Maximum number of clients reached');
    }

    const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'text/event-stream',
      'Connection': 'keep-alive',
      'Cache-Control': 'no-cache',
      'X-Accel-Buffering': 'no',
    };

    if (this.config.compression) {
      headers['Content-Encoding'] = 'gzip';
    }

    response.writeHead(200, headers);

    const now = new Date().toISOString();
    const client: SSEClient = {
      id: clientId,
      response,
      topics: new Set(topics),
      metadata: {},
      connectedAt: now,
      lastEventId: undefined,
      lastEventAt: now,
      lastHeartbeatAt: now,
    };

    this.clients.set(clientId, client);
    topics.forEach(topic => this.activeTopics.add(topic));

    // Send retry interval
    response.write(`retry: ${this.config.retryInterval}\n\n`);

    if (this.config.debug) {
      this.logger.debug(`Client connected: ${clientId}, topics: ${topics.join(', ')}`);
    }

    return clientId;
  }

  async removeClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      try {
        // Remove client's subscriptions
        const clientSubs = Array.from(this.subscriptions.values())
          .filter(sub => sub.clientId === clientId);
        
        for (const sub of clientSubs) {
          this.subscriptions.delete(sub.topic);
        }

        // Update active topics
        client.topics.forEach(topic => {
          const hasOtherClients = Array.from(this.clients.values())
            .some(c => c.id !== clientId && c.topics.has(topic));
          if (!hasOtherClients) {
            this.activeTopics.delete(topic);
          }
        });

        // Close connection
        client.response.end();
        this.clients.delete(clientId);

        if (this.config.debug) {
          this.logger.debug(`Client disconnected: ${clientId}`);
        }
      } catch (error) {
        this.logger.error(`Error removing client ${clientId}:`, error);
        // Ensure client is removed even if there's an error
        this.clients.delete(clientId);
      }
    }
  }

  subscribe(clientId: string, topics: string[]) {
    const client = this.clients.get(clientId);
    if (client) {
      const now = new Date().toISOString();
      topics.forEach(topic => {
        client.topics.add(topic);
        this.activeTopics.add(topic);

        const subscription: SSESubscription = {
          topic,
          clientId,
          metadata: {},
          createdAt: now,
          updatedAt: now,
        };
        this.subscriptions.set(`${clientId}:${topic}`, subscription);
      });

      if (this.config.debug) {
        this.logger.debug(`Client ${clientId} subscribed to topics: ${topics.join(', ')}`);
      }
    }
  }

  unsubscribe(clientId: string, topics: string[]) {
    const client = this.clients.get(clientId);
    if (client) {
      topics.forEach(topic => {
        client.topics.delete(topic);
        this.subscriptions.delete(`${clientId}:${topic}`);

        // Check if topic is still active
        const hasOtherClients = Array.from(this.clients.values())
          .some(c => c.id !== clientId && c.topics.has(topic));
        if (!hasOtherClients) {
          this.activeTopics.delete(topic);
        }
      });

      if (this.config.debug) {
        this.logger.debug(`Client ${clientId} unsubscribed from topics: ${topics.join(', ')}`);
      }
    }
  }

  broadcast<T = any>(event: SSEEvent<T>) {
    if (!this.config.enabled) {
      return;
    }

    const now = new Date().toISOString();
    const finalEvent = {
      ...event,
      timestamp: now,
    };

    let sentCount = 0;
    this.clients.forEach(client => {
      if (!event.topic || client.topics.has(event.topic)) {
        try {
          // Get subscription for this client and topic
          const subscription = event.topic ? 
            this.subscriptions.get(`${client.id}:${event.topic}`) : 
            undefined;

          // Apply filter if exists
          if (subscription?.filter && !subscription.filter(finalEvent)) {
            return;
          }

          // Apply transform if exists
          const transformedEvent = subscription?.transform ? 
            subscription.transform(finalEvent) : 
            finalEvent;

          this.sendEvent(client, transformedEvent);
          client.lastEventAt = now;
          sentCount++;
        } catch (error) {
          this.logger.error(`Failed to send event to client ${client.id}:`, error);
          this.removeClient(client.id);
        }
      }
    });

    if (this.config.debug) {
      this.logger.debug(`Broadcast event sent to ${sentCount} clients`);
    }
  }

  sendToClient<T = any>(clientId: string, event: SSEEvent<T>) {
    if (!this.config.enabled) {
      return;
    }

    const client = this.clients.get(clientId);
    if (client) {
      const now = new Date().toISOString();
      const finalEvent = {
        ...event,
        timestamp: now,
      };

      try {
        this.sendEvent(client, finalEvent);
        client.lastEventAt = now;

        if (this.config.debug) {
          this.logger.debug(`Event sent to client ${clientId}`);
        }
      } catch (error) {
        this.logger.error(`Failed to send event to client ${clientId}:`, error);
        this.removeClient(clientId);
      }
    }
  }

  private sendEvent(client: SSEClient, event: SSEEvent) {
    if (!this.config.enabled) {
      return;
    }

    try {
      let message = '';

      if (event.id) {
        message += `id: ${event.id}\n`;
        client.lastEventId = event.id;
      }

      if (event.event) {
        message += `event: ${event.event}\n`;
      }

      if (event.retry) {
        message += `retry: ${event.retry}\n`;
      }

      if (event.comment) {
        message += `: ${event.comment}\n`;
      }

      const data = typeof event.data === 'string' ? event.data : JSON.stringify(event.data);
      if (this.config.maxEventSize && Buffer.byteLength(data) > this.config.maxEventSize) {
        throw new Error('Event data exceeds maximum size limit');
      }

      message += `data: ${data}\n\n`;

      client.response.write(message);
      client.lastHeartbeatAt = new Date().toISOString();
    } catch (error) {
      this.logger.error(`Error sending event to client ${client.id}:`, error);
      throw error;
    }
  }

  getClient(clientId: string): SSEClient | undefined {
    return this.clients.get(clientId);
  }

  getClients(): SSEClient[] {
    return Array.from(this.clients.values());
  }

  getActiveTopics(): string[] {
    return Array.from(this.activeTopics);
  }

  getSubscriptions(): SSESubscription[] {
    return Array.from(this.subscriptions.values());
  }
} 