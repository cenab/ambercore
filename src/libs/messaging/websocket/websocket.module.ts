import { DynamicModule, Module } from '@nestjs/common';
import { WebSocketService } from './websocket.service';
import { WsConfig, defaultWsConfig } from '../common/config.interface';
import { WS_CONFIG } from './websocket.constants';
import { CacheModule } from '@core/cache/cache.module';

@Module({})
export class WebSocketModule {
  static forRoot(config?: Partial<WsConfig>): DynamicModule {
    const finalConfig: WsConfig = {
      ...defaultWsConfig,
      wsUrl: process.env.WS_URL || 'ws://localhost:3000',
      ...config,
    } as WsConfig;

    return {
      module: WebSocketModule,
      imports: [CacheModule],
      providers: [
        {
          provide: WS_CONFIG,
          useValue: finalConfig,
        },
        WebSocketService,
      ],
      exports: [WebSocketService],
      global: true,
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: WebSocketModule,
      imports: [CacheModule],
      providers: [WebSocketService],
      exports: [WebSocketService],
    };
  }
}