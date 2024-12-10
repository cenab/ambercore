import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SharedModule } from '../shared/shared.module';
import { PusherService } from './services/pusher.service';
import { MessagingService } from './services/messaging.service';
import { MessagingController } from './controllers/messaging.controller';
import { PusherGateway } from './gateways/pusher.gateway';

@Module({
  imports: [
    ConfigModule,
    SharedModule,
  ],
  providers: [
    PusherService,
    MessagingService,
    PusherGateway,
  ],
  controllers: [MessagingController],
  exports: [MessagingService]
})
export class MessagingModule {} 