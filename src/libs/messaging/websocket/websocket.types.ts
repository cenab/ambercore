import { BaseConfig, ConnectionConfig, SecurityConfig } from '../../../common/interfaces/config.interface';
import { WebSocketMessage as BaseWebSocketMessage } from '../../../common/types/api.types';

export interface WebSocketConfig extends BaseConfig, ConnectionConfig, SecurityConfig {
  namespace?: string;
  maxConnections?: number;
  pingInterval?: number;
  pingTimeout?: number;
  transports?: ('websocket' | 'polling')[];
  heartbeatInterval?: number;
  reconnectInterval?: number;
  maxRetries?: number;
}

export interface WebSocketRoom {
  id: string;
  name: string;
  clients: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface WebSocketClient {
  id: string;
  rooms: string[];
  metadata?: Record<string, any>;
  connectedAt: string;
  lastActiveAt: string;
}

export interface WebSocketHandler<T = any> {
  event: string;
  handler: (data: T, clientId: string) => Promise<void>;
  metadata?: Record<string, any>;
}

export interface WebSocketMessage<T = any> extends BaseWebSocketMessage<T> {
  room?: string;
} 