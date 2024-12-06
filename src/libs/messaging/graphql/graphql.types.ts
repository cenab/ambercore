import { DocumentNode } from 'graphql';

export interface GraphQLConfig {
  endpoint: string;
  headers?: Record<string, string>;
  wsEndpoint?: string;
}

export interface GraphQLRequestOptions {
  query: string | DocumentNode;
  variables?: Record<string, any>;
  operationName?: string;
  headers?: Record<string, string>;
}

export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{
    message: string;
    locations?: Array<{ line: number; column: number }>;
    path?: Array<string | number>;
    extensions?: Record<string, any>;
  }>;
}

export interface GraphQLSubscriptionOptions extends GraphQLRequestOptions {
  onData: (data: any) => void;
  onError?: (error: any) => void;
  onComplete?: () => void;
}

export class GraphQLError extends Error {
  constructor(
    message: string,
    public response?: GraphQLResponse,
    public status?: number
  ) {
    super(message);
    this.name = 'GraphQLError';
  }
} 