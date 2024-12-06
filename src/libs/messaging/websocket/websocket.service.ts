import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';
import { WebSocketConfig } from './websocket.types';
import { MetricsService } from '../../../core/metrics/metrics.service';

@Injectable()
export class WebSocketService {
  protected readonly logger = new Logger(WebSocketService.name);
  private readonly clients: Set<WebSocket> = new Set();
  private readonly config: WebSocketConfig;

  constructor(
    private readonly configService: ConfigService,
    private readonly metricsService: MetricsService,
  ) {
    this.config = {
      heartbeatInterval: configService.get('WS_HEARTBEAT_INTERVAL') || 30000,
      reconnectInterval: configService.get('WS_RECONNECT_INTERVAL') || 5000,
      maxRetries: configService.get('WS_MAX_RETRIES') || 5,
    };
  }

  async connect(url: string): Promise<WebSocket> {
    try {
      const ws = new WebSocket(url);
      this.setupWebSocketHandlers(ws);
      this.clients.add(ws);
      this.metricsService.setActiveConnections('websocket', this.clients.size);
      return ws;
    } catch (error) {
      this.logger.error(`Failed to connect to WebSocket at ${url}:`, error);
      throw error;
    }
  }

  private setupWebSocketHandlers(ws: WebSocket): void {
    ws.on('open', () => {
      this.logger.log('WebSocket connection established');
      this.startHeartbeat(ws);
    });

    ws.on('close', () => {
      this.logger.log('WebSocket connection closed');
      this.clients.delete(ws);
      this.metricsService.setActiveConnections('websocket', this.clients.size);
    });

    ws.on('error', (error) => {
      this.logger.error('WebSocket error:', error);
      this.metricsService.recordHttpError('WS', 'connection', error.message);
    });

    ws.on('ping', () => {
      try {
        ws.pong();
      } catch (error) {
        this.logger.error('Failed to send pong:', error);
      }
    });
  }

  private startHeartbeat(ws: WebSocket): void {
    const interval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.ping();
        } catch (error) {
          this.logger.error('Failed to send ping:', error);
          clearInterval(interval);
        }
      } else {
        clearInterval(interval);
      }
    }, this.config.heartbeatInterval);

    ws.on('close', () => clearInterval(interval));
  }

  async send(ws: WebSocket, data: string | Buffer): Promise<void> {
    try {
      if (ws.readyState === WebSocket.OPEN) {
        await new Promise<void>((resolve, reject) => {
          ws.send(data, (error) => {
            if (error) {
              this.logger.error('Failed to send message:', error);
              reject(error);
            } else {
              resolve();
            }
          });
        });
      } else {
        throw new Error('WebSocket is not open');
      }
    } catch (error) {
      this.logger.error('Error sending message:', error);
      throw error;
    }
  }

  async broadcast(data: string | Buffer): Promise<void> {
    const sendPromises = Array.from(this.clients)
      .filter((client) => client.readyState === WebSocket.OPEN)
      .map((client) => this.send(client, data));

    try {
      await Promise.all(sendPromises);
    } catch (error) {
      this.logger.error('Error broadcasting message:', error);
      throw error;
    }
  }

  disconnect(ws: WebSocket): void {
    try {
      ws.close();
      this.clients.delete(ws);
      this.metricsService.setActiveConnections('websocket', this.clients.size);
    } catch (error) {
      this.logger.error('Error disconnecting WebSocket:', error);
      throw error;
    }
  }

  disconnectAll(): void {
    try {
      this.clients.forEach((client) => {
        client.close();
      });
      this.clients.clear();
      this.metricsService.setActiveConnections('websocket', 0);
    } catch (error) {
      this.logger.error('Error disconnecting all WebSockets:', error);
      throw error;
    }
  }

  getActiveConnections(): number {
    return this.clients.size;
  }
} 