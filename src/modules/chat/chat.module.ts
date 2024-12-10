import { Module, NestModule, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import { ChatController } from './controllers/chat.controller';
import { ChatService } from './services/chat.service';
import { MessagingModule } from '../../core/messaging/messaging.module';
import { AuthModule } from '../auth/auth.module';
import { AuthMiddleware } from '../auth/middleware/auth.middleware';

@Module({
  imports: [MessagingModule, AuthModule],
  controllers: [ChatController],
  providers: [ChatService],
  exports: [ChatService]
})
export class ChatModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AuthMiddleware)
      .forRoutes(
        { path: 'chat/*', method: RequestMethod.ALL }
      );
  }
} 