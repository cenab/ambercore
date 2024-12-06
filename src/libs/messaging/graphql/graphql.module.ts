import { DynamicModule, Module } from '@nestjs/common';
import { GraphQLClient } from './graphql.client';
import { BaseUrlConfig, defaultConfig } from '../common/config.interface';
import { GRAPHQL_CONFIG } from './graphql.constants';

@Module({})
export class GraphQLModule {
  static forRoot(config?: Partial<BaseUrlConfig>): DynamicModule {
    const finalConfig: BaseUrlConfig = {
      ...defaultConfig,
      baseUrl: process.env.GRAPHQL_URL || 'http://localhost:3000/graphql',
      ...config,
    };

    return {
      module: GraphQLModule,
      providers: [
        {
          provide: GRAPHQL_CONFIG,
          useValue: finalConfig,
        },
        GraphQLClient,
      ],
      exports: [GraphQLClient],
      global: true,
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: GraphQLModule,
      providers: [GraphQLClient],
      exports: [GraphQLClient],
    };
  }
} 