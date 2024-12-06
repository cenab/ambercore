export interface BaseConfig {
  headers?: Record<string, string>;
  timeout?: number;
  retries?: number;
  debug?: boolean;
}

export interface BaseUrlConfig extends BaseConfig {
  baseUrl: string;
}

export interface WsConfig extends BaseConfig {
  wsUrl: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

export interface GrpcConfig extends BaseConfig {
  host: string;
  port: number;
  packageName: string;
  protoPath: string;
}

export interface WebhookConfig extends BaseConfig {
  endpoint: string;
  secret?: string;
  maxRetries?: number;
  retryDelay?: number;
}

export const defaultConfig: BaseConfig = {
  timeout: 5000,
  retries: 3,
  debug: false,
  headers: {
    'Content-Type': 'application/json',
  },
};

export const defaultWsConfig: Partial<WsConfig> = {
  ...defaultConfig,
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
  heartbeatInterval: 30000,
};

export const defaultGrpcConfig: Partial<GrpcConfig> = {
  ...defaultConfig,
  port: 50051,
};

export const defaultWebhookConfig: Partial<WebhookConfig> = {
  ...defaultConfig,
  maxRetries: 3,
  retryDelay: 1000,
}; 