import { DynamicModule, Module } from '@nestjs/common';
import { GrpcClient } from './grpc.client';
import { GrpcConfig, defaultGrpcConfig } from '../common/config.interface';
import { GRPC_CONFIG } from './grpc.constants';
import { join } from 'path';

@Module({})
export class GrpcModule {
  static forRoot(config?: Partial<GrpcConfig>): DynamicModule {
    const finalConfig: GrpcConfig = {
      ...defaultGrpcConfig,
      host: process.env.GRPC_HOST || 'localhost',
      port: parseInt(process.env.GRPC_PORT || '50051', 10),
      packageName: process.env.GRPC_PACKAGE || 'service',
      protoPath: process.env.GRPC_PROTO_PATH || join(__dirname, 'proto/service.proto'),
      ...config,
    } as GrpcConfig;

    return {
      module: GrpcModule,
      providers: [
        {
          provide: GRPC_CONFIG,
          useValue: finalConfig,
        },
        GrpcClient,
      ],
      exports: [GrpcClient],
      global: true,
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: GrpcModule,
      providers: [GrpcClient],
      exports: [GrpcClient],
    };
  }
} 