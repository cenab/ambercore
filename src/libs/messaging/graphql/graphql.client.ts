import { Injectable, Logger } from '@nestjs/common';
import { print } from 'graphql';
import WebSocket from 'ws';
import {
  GraphQLConfig,
  GraphQLRequestOptions,
  GraphQLResponse,
  GraphQLError,
  GraphQLSubscriptionOptions,
} from './graphql.types';

@Injectable()
export class GraphQLClient {
  private readonly logger = new Logger(GraphQLClient.name);
  private readonly headers: Record<string, string>;
  private readonly endpoint: string;
  private readonly wsEndpoint?: string;

  constructor(private readonly config: GraphQLConfig) {
    this.endpoint = config.endpoint;
    this.wsEndpoint = config.wsEndpoint;
    this.headers = {
      'Content-Type': 'application/json',
      ...config.headers,
    };
  }

  async query<T = any>(options: GraphQLRequestOptions): Promise<GraphQLResponse<T>> {
    const { query, variables, operationName, headers } = options;
    const queryString = typeof query === 'string' ? query : print(query);

    try {
      const response = await fetch(this.endpoint, {
        method: 'POST',
        headers: {
          ...this.headers,
          ...headers,
        },
        body: JSON.stringify({
          query: queryString,
          variables,
          operationName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new GraphQLError('GraphQL request failed', result, response.status);
      }

      if (result.errors?.length) {
        throw new GraphQLError('GraphQL query returned errors', result);
      }

      return result;
    } catch (error) {
      this.logger.error('GraphQL query failed', error);
      throw error;
    }
  }

  subscribe(options: GraphQLSubscriptionOptions): () => void {
    if (!this.wsEndpoint) {
      throw new Error('WebSocket endpoint not configured');
    }

    const ws = new WebSocket(this.wsEndpoint, {
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    const queryString = typeof options.query === 'string' ? options.query : print(options.query);

    ws.on('open', () => {
      ws.send(JSON.stringify({
        type: 'start',
        payload: {
          query: queryString,
          variables: options.variables,
          operationName: options.operationName,
        },
      }));
    });

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        if (message.type === 'data') {
          options.onData(message.payload);
        }
      } catch (error) {
        if (options.onError) {
          options.onError(error);
        }
      }
    });

    ws.on('error', (error) => {
      if (options.onError) {
        options.onError(error);
      }
    });

    ws.on('close', () => {
      if (options.onComplete) {
        options.onComplete();
      }
    });

    return () => {
      ws.close();
    };
  }
} 