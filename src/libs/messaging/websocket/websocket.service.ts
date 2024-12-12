import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { WebSocket, WebSocketServer } from 'ws';
import { MetricsService } from '../../../core/metrics/metrics.service';
import { RedisService } from '../../../core/shared/services/redis.service';

interface WebSocketClient extends WebSocket {
  id: string;
  isAlive: boolean;
}

@Injectable()
export class WebSocketService implements OnModuleInit, OnModuleDestroy {
  private server: WebSocketServer;
  private readonly clients = new Map<string, WebSocketClient>();
  private heartbeatInterval: NodeJS.Timeout;

  constructor(
    private readonly metricsService: MetricsService,
    private readonly redisService: RedisService,
  ) {}

  onModuleInit() {
    this.server = new WebSocketServer({ port: 8080 });
    this.setupWebSocketServer();
    this.startHeartbeat();
  }

  onModuleDestroy() {
    this.stopHeartbeat();
    this.server.close();
  }

  private setupWebSocketServer() {
    this.server.on('connection', (ws: WebSocketClient) => {
      ws.id = Math.random().toString(36).substring(7);
      ws.isAlive = true;
      this.clients.set(ws.id, ws);

      this.recordMetrics();

      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (message: string) => {
        this.handleMessage(ws, message);
      });

      ws.on('error', (error: Error) => {
        console.error(`WebSocket error for client ${ws.id}:`, error);
        this.recordError('connection_error');
      });

      ws.on('close', () => {
        this.clients.delete(ws.id);
        this.recordMetrics();
      });
    });
  }

  private startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this.server.clients.forEach((ws: WebSocketClient) => {
        if (!ws.isAlive) {
          this.clients.delete(ws.id);
          return ws.terminate();
        }

        ws.isAlive = false;
        ws.ping();
      });

      this.recordMetrics();
    }, 30000);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    this.recordMetrics();
  }

  private async handleMessage(ws: WebSocketClient, message: string) {
    try {
      const data = JSON.parse(message);
      // Handle different message types
      switch (data.type) {
        case 'ping':
          ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
          break;
        default:
          console.warn(`Unknown message type: ${data.type}`);
      }
    } catch (error) {
      console.error('Error handling message:', error);
      this.recordError('message_error');
    }
  }

  private async recordMetrics() {
    await this.metricsService.recordMetric({
      name: 'websocket_connections',
      value: this.clients.size,
      labels: { type: 'active' }
    });
  }

  private async recordError(type: string) {
    await this.metricsService.recordMetric({
      name: 'websocket_errors',
      value: 1,
      labels: { type }
    });
  }

  broadcast(message: string) {
    this.clients.forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }
} 