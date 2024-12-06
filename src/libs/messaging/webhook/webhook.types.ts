import { Request, Response } from 'express';

export interface WebhookConfig {
  // Webhook server config
  secret?: string;
  path?: string;
  port?: number;
  verifySignature?: boolean;

  // Webhook client config
  endpoints?: Record<string, string>;
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface WebhookEvent<T = any> {
  id: string;
  type: string;
  data: T;
  timestamp: string;
  signature?: string;
}

export interface WebhookDeliveryResult {
  success: boolean;
  statusCode?: number;
  response?: any;
  error?: string;
  retries?: number;
  timestamp: string;
}

export interface WebhookHandler<T = any> {
  type: string;
  handler: (event: WebhookEvent<T>, req: Request, res: Response) => Promise<void>;
  verifySignature?: boolean;
}

export interface WebhookDeliveryOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  headers?: Record<string, string>;
}

export interface WebhookSubscription {
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

export interface WebhookSignatureOptions {
  algorithm?: 'sha256' | 'sha512';
  header?: string;
  prefix?: string;
} 