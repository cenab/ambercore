import { Injectable } from '@nestjs/common';
import { RestConfig, RequestOptions, RestError, ApiResponse } from './rest.types';

@Injectable()
export class RestClient {
  private readonly config: RestConfig;

  constructor(config: RestConfig) {
    this.config = config;
  }

  private async request<T>(
    path: string,
    method: string,
    options: RequestOptions = {}
  ): Promise<ApiResponse<T>> {
    const url = new URL(path, this.config.baseUrl);
    
    // Add query parameters
    if (options.query) {
      Object.entries(options.query).forEach(([key, value]) => {
        url.searchParams.append(key, value);
      });
    }

    try {
      const response = await fetch(url.toString(), {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        const error: RestError = {
          code: response.status.toString(),
          message: data.message || response.statusText,
          statusCode: response.status,
          path: url.pathname,
        };
        throw error;
      }

      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw {
          code: 'REQUEST_ERROR',
          message: error.message,
          statusCode: 500,
          path: url.pathname,
        } as RestError;
      }
      throw error;
    }
  }

  async get<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, 'GET', options);
  }

  async post<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, 'POST', options);
  }

  async put<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, 'PUT', options);
  }

  async patch<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, 'PATCH', options);
  }

  async delete<T>(path: string, options?: RequestOptions): Promise<ApiResponse<T>> {
    return this.request<T>(path, 'DELETE', options);
  }
} 