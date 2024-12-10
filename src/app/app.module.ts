import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validate } from '../core/config/config.validator';
import { SharedModule } from '../core/shared/shared.module';
import { MessagingModule } from '../core/messaging/messaging.module';
import { ChatModule } from '../modules/chat/chat.module';
import { AuthModule } from '../modules/auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
      envFilePath: '.env',
      cache: true,
    }),
    SharedModule,
    MessagingModule,
    ChatModule,
    AuthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
