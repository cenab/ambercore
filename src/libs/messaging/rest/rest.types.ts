import { ApiResponse, ApiError, PaginatedResponse } from '../../../common/types/api.types';

export interface RestConfig {
  baseUrl: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface RequestOptions {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: any;
  headers?: Record<string, string>;
}

export interface RestEndpoint<T = any, R = any> {
  path: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  requestType: T;
  responseType: R;
  requiresAuth: boolean;
  description?: string;
}

export interface RestError extends ApiError {
  statusCode: number;
  path: string;
}

export { ApiResponse, PaginatedResponse }; 