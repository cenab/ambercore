import { DynamicModule, Module } from '@nestjs/common';
import { RestClient } from './rest.client';
import { BaseUrlConfig, defaultConfig } from '../common/config.interface';
import { REST_CONFIG } from './rest.constants';

@Module({})
export class RestModule {
  static forRoot(config?: Partial<BaseUrlConfig>): DynamicModule {
    const finalConfig: BaseUrlConfig = {
      ...defaultConfig,
      baseUrl: process.env.API_BASE_URL || 'http://localhost:3000',
      ...config,
    };

    return {
      module: RestModule,
      providers: [
        {
          provide: REST_CONFIG,
          useValue: finalConfig,
        },
        RestClient,
      ],
      exports: [RestClient],
      global: true,
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: RestModule,
      providers: [RestClient],
      exports: [RestClient],
    };
  }
} 