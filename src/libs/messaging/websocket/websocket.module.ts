import { Module } from '@nestjs/common';
import { WebSocketService } from './websocket.service';
import { SharedModule } from '../../../core/shared/shared.module';
import { MetricsModule } from '../../../core/metrics/metrics.module';

@Module({
  imports: [SharedModule, MetricsModule],
  providers: [WebSocketService],
  exports: [WebSocketService],
})
export class WebSocketModule {}