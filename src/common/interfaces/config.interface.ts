export interface BaseConfig {
  enabled?: boolean;
  debug?: boolean;
  logger?: {
    level: 'error' | 'warn' | 'info' | 'debug';
    pretty?: boolean;
  };
}

export interface CacheConfig extends BaseConfig {
  ttl?: number;
  prefix?: string;
}

export interface SecurityConfig extends BaseConfig {
  secret?: string;
  signatureHeader?: string;
  signatureAlgorithm?: 'sha256' | 'sha512';
}

export interface RetryConfig {
  attempts?: number;
  delay?: number;
  maxDelay?: number;
  timeout?: number;
}

export interface ConnectionConfig {
  host?: string;
  port?: number;
  path?: string;
  ssl?: boolean;
  timeout?: number;
  keepAlive?: boolean;
  retryConfig?: RetryConfig;
}

export interface AuthConfig extends BaseConfig {
  required?: boolean;
  headerName?: string;
  tokenType?: 'Bearer' | 'Basic';
  roles?: string[];
} 