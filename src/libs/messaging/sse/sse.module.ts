import { DynamicModule, Module } from '@nestjs/common';
import { SSEService } from './sse.service';
import { SSEConfig } from './sse.types';

@Module({})
export class SSEModule {
  static forRoot(config?: SSEConfig): DynamicModule {
    return {
      module: SSEModule,
      providers: [
        {
          provide: SSEService,
          useFactory: () => new SSEService(config),
        },
      ],
      exports: [SSEService],
    };
  }
} 