import { BaseConfig, ConnectionConfig, SecurityConfig } from '../../../common/interfaces/config.interface';
import { Response } from 'express';

export interface SSEConfig extends BaseConfig, ConnectionConfig, SecurityConfig {
  heartbeatInterval?: number;
  retryInterval?: number;
  maxEventSize?: number;
  compression?: boolean;
  retryAfter?: number;
  maxClients?: number;
}

export interface SSEClient {
  id: string;
  response: Response;
  topics: Set<string>;
  metadata?: Record<string, any>;
  connectedAt: string;
  lastEventId?: string;
  lastEventAt: string;
  lastHeartbeatAt: string;
}

export interface SSEEvent<T = any> {
  id?: string;
  event?: string;
  data: T;
  retry?: number;
  comment?: string;
  topic?: string;
  metadata?: Record<string, any>;
  timestamp?: string;
}

export interface SSESubscription {
  topic: string;
  clientId: string;
  filter?: (event: SSEEvent) => boolean;
  transform?: (event: SSEEvent) => SSEEvent;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
} 