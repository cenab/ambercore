import { BaseConfig, ConnectionConfig, SecurityConfig } from '../../../common/interfaces/config.interface';
import { ChannelCredentials, Metadata } from '@grpc/grpc-js';

export interface GRPCConfig extends BaseConfig, ConnectionConfig, SecurityConfig {
  protoPath?: string;
  packageName?: string;
  serviceName?: string;
  credentials?: ChannelCredentials;
  maxMessageSize?: number;
  keepaliveInterval?: number;
  loadBalancing?: 'round_robin' | 'pick_first';
  compression?: boolean;
  options?: {
    'grpc.keepalive_time_ms'?: number;
    'grpc.keepalive_timeout_ms'?: number;
    'grpc.keepalive_permit_without_calls'?: number;
    'grpc.http2.min_time_between_pings_ms'?: number;
    'grpc.http2.max_pings_without_data'?: number;
    [key: string]: any;
  };
}

export interface GRPCServiceDefinition {
  service: any;
  name: string;
  package: string;
}

export interface GRPCCallOptions {
  deadline?: Date;
  metadata?: Record<string, string | string[]>;
  propagate_flags?: number;
  credentials?: ChannelCredentials;
}

export interface GRPCClient {
  id: string;
  streams: string[];
  metadata?: Record<string, any>;
  connectedAt: string;
  lastActiveAt: string;
}

export interface GRPCStream<T = any> {
  id: string;
  type: 'unary' | 'client' | 'server' | 'bidi';
  method: string;
  metadata?: Record<string, any>;
  status: 'active' | 'paused' | 'closed';
  data?: T;
  error?: Error;
  createdAt: string;
  updatedAt: string;
}

export interface GRPCHandler<T = any> {
  method: string;
  type: 'unary' | 'client' | 'server' | 'bidi';
  handler: (data: T, metadata?: Metadata) => Promise<any>;
  metadata?: Record<string, any>;
}

export interface GRPCStreamResponse<T> {
  on(event: 'data', listener: (data: T) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: string, listener: Function): void;
  cancel(): void;
}

export interface GRPCClientStreamRequest<T> {
  write(data: T): boolean;
  end(): void;
  on(event: 'data', listener: (data: any) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  on(event: string, listener: Function): void;
}

export type GRPCUnaryCall<Request, Response> = (
  request: Request,
  options?: GRPCCallOptions
) => Promise<Response>;

export type GRPCServerStreamCall<Request, Response> = (
  request: Request,
  options?: GRPCCallOptions
) => GRPCStreamResponse<Response>;

export type GRPCClientStreamCall<Request, Response> = (
  options?: GRPCCallOptions
) => GRPCClientStreamRequest<Request> & Promise<Response>;

export type GRPCBidiStreamCall<Request, Response> = (
  options?: GRPCCallOptions
) => GRPCStreamResponse<Response> & GRPCClientStreamRequest<Request>; 