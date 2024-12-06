export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> extends Omit<ApiResponse<T[]>, 'data'> {
  data: T[];
  meta: PaginationMeta;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export interface WebSocketMessage<T = any> {
  event: string;
  data: T;
  timestamp: string;
}

export interface SSEMessage<T = any> {
  id: string;
  data: T;
  event?: string;
  retry?: number;
}

export type ApiMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiEndpoint {
  path: string;
  method: ApiMethod;
  description: string;
  requiresAuth: boolean;
} 