import { DynamicModule, Module } from '@nestjs/common';
import { WebhookService } from './webhook.service';
import { WebhookConfig, defaultWebhookConfig } from '../common/config.interface';
import { WEBHOOK_CONFIG } from './webhook.constants';

@Module({})
export class WebhookModule {
  static forRoot(config?: Partial<WebhookConfig>): DynamicModule {
    const finalConfig: WebhookConfig = {
      ...defaultWebhookConfig,
      endpoint: process.env.WEBHOOK_ENDPOINT || 'http://localhost:3000/webhook',
      secret: process.env.WEBHOOK_SECRET,
      ...config,
    } as WebhookConfig;

    return {
      module: WebhookModule,
      providers: [
        {
          provide: WEBHOOK_CONFIG,
          useValue: finalConfig,
        },
        WebhookService,
      ],
      exports: [WebhookService],
      global: true,
    };
  }

  static forFeature(): DynamicModule {
    return {
      module: WebhookModule,
      providers: [WebhookService],
      exports: [WebhookService],
    };
  }
} 