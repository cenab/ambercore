export const CACHE_SERVICE = 'CACHE_SERVICE';
export const CONFIG_SERVICE = 'CONFIG_SERVICE';
export const DATABASE_SERVICE = 'DATABASE_SERVICE';
export const MESSAGING_SERVICE = 'MESSAGING_SERVICE';
export const METRICS_SERVICE = 'METRICS_SERVICE';

// Library-specific tokens
export const WEBSOCKET_CONFIG = 'WEBSOCKET_CONFIG';
export const GRAPHQL_CONFIG = 'GRAPHQL_CONFIG';
export const GRPC_CONFIG = 'GRPC_CONFIG';
export const SSE_CONFIG = 'SSE_CONFIG';
export const WEBHOOK_CONFIG = 'WEBHOOK_CONFIG';

// Redis channels
export const REDIS_CHANNELS = {
  WEBSOCKET_EVENTS: 'websocket_events',
  WEBHOOK_EVENTS: 'webhook_events',
  SSE_EVENTS: 'sse_events',
} as const;

// Redis key prefixes
export const REDIS_PREFIXES = {
  WEBSOCKET: 'ws',
  WEBHOOK: 'wh',
  SSE: 'sse',
  GRAPHQL: 'gql',
  CACHE: 'cache',
} as const; 