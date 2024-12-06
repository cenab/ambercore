import { Injectable, Logger } from '@nestjs/common';
import * as grpc from '@grpc/grpc-js';
import { loadSync, PackageDefinition } from '@grpc/proto-loader';
import { join } from 'path';
import { Observable, Subject } from 'rxjs';
import {
  GRPCConfig,
  GRPCServiceDefinition,
  GRPCCallOptions,
  GRPCClient as GRPCClientType,
} from './grpc.types';

type GrpcObject = { [key: string]: any };
type ServiceClient = { [key: string]: Function } & { close: () => void };

@Injectable()
export class GrpcClient {
  private readonly clients: Map<string, ServiceClient> = new Map();
  private readonly logger = new Logger(GrpcClient.name);

  constructor(private readonly config: GRPCConfig) {
    if (config.protoPath && config.packageName && config.serviceName) {
      this.loadService({
        name: config.serviceName,
        package: config.packageName,
        service: config.serviceName,
      });
    }
  }

  loadService(serviceDefinition: GRPCServiceDefinition): void {
    const protoPath = this.config.protoPath!;
    const packageDefinition = loadSync(protoPath, {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
    });

    const grpcObject = grpc.loadPackageDefinition(packageDefinition) as GrpcObject;
    const packageObject = grpcObject[serviceDefinition.package] as GrpcObject;
    
    if (!packageObject) {
      throw new Error(`Package ${serviceDefinition.package} not found`);
    }

    const ServiceClass = packageObject[serviceDefinition.service] as grpc.ServiceClientConstructor;
    
    if (!ServiceClass) {
      throw new Error(`Service ${serviceDefinition.service} not found in package ${serviceDefinition.package}`);
    }

    const credentials = this.config.credentials || (
      this.config.ssl ? grpc.credentials.createSsl() : grpc.credentials.createInsecure()
    );

    const client = new ServiceClass(
      `${this.config.host}:${this.config.port}`,
      credentials,
      this.config.options
    ) as ServiceClient;

    this.clients.set(serviceDefinition.name, client);
    this.logger.log(`Loaded gRPC service: ${serviceDefinition.name}`);
  }

  private getClient(serviceName?: string): ServiceClient {
    const client = serviceName ? this.clients.get(serviceName) : Array.from(this.clients.values())[0];
    if (!client) {
      throw new Error(`Service ${serviceName || 'default'} not loaded`);
    }
    return client;
  }

  private createMetadata(options?: GRPCCallOptions): grpc.Metadata {
    const metadata = new grpc.Metadata();
    if (options?.metadata) {
      Object.entries(options.metadata).forEach(([key, value]) => {
        if (Array.isArray(value)) {
          value.forEach((v) => metadata.add(key, v));
        } else {
          metadata.add(key, value as string);
        }
      });
    }
    return metadata;
  }

  async unaryCall<Request = any, Response = any>(
    methodName: string,
    request: Request,
    options?: GRPCCallOptions
  ): Promise<Response> {
    const client = this.getClient();
    const method = client[methodName]?.bind(client);

    if (typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found`);
    }

    return new Promise((resolve, reject) => {
      method(
        request,
        this.createMetadata(options),
        options,
        (error: grpc.ServiceError | null, response: Response) => {
          if (error) {
            this.logger.error(`gRPC unary call error: ${error.message}`);
            reject(error);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  serverStreamCall<Request = any, Response = any>(
    methodName: string,
    request: Request,
    options?: GRPCCallOptions
  ): Observable<Response> {
    const client = this.getClient();
    const method = client[methodName]?.bind(client);

    if (typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found`);
    }

    const subject = new Subject<Response>();
    const call = method(request, this.createMetadata(options), options);

    call.on('data', (data: Response) => subject.next(data));
    call.on('error', (error: Error) => subject.error(error));
    call.on('end', () => subject.complete());

    return subject.asObservable();
  }

  clientStreamCall<Request = any, Response = any>(
    methodName: string,
    options?: GRPCCallOptions
  ): {
    write: (data: Request) => boolean;
    complete: () => Promise<Response>;
  } {
    const client = this.getClient();
    const method = client[methodName]?.bind(client);

    if (typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found`);
    }

    let call: grpc.ClientWritableStream<Request>;

    const promise = new Promise<Response>((resolve, reject) => {
      call = method(this.createMetadata(options), options, (error: grpc.ServiceError | null, response: Response) => {
        if (error) {
          reject(error);
        } else {
          resolve(response);
        }
      });
    });

    return {
      write: (data: Request) => call.write(data),
      complete: () => {
        call.end();
        return promise;
      },
    };
  }

  bidiStreamCall<Request = any, Response = any>(
    methodName: string,
    options?: GRPCCallOptions
  ): {
    write: (data: Request) => boolean;
    complete: () => void;
    subscribe: (observer: { next: (data: Response) => void; error?: (error: Error) => void; complete?: () => void }) => void;
  } {
    const client = this.getClient();
    const method = client[methodName]?.bind(client);

    if (typeof method !== 'function') {
      throw new Error(`Method ${methodName} not found`);
    }

    const call = method(this.createMetadata(options), options) as grpc.ClientDuplexStream<Request, Response>;

    return {
      write: (data: Request) => call.write(data),
      complete: () => call.end(),
      subscribe: (observer) => {
        call.on('data', (data: Response) => observer.next(data));
        if (observer.error) call.on('error', (error: Error) => observer.error!(error));
        if (observer.complete) call.on('end', () => observer.complete!());
      },
    };
  }

  closeAll(): void {
    this.clients.forEach((client) => {
      client.close();
    });
    this.clients.clear();
    this.logger.log('Closed all gRPC clients');
  }
} 