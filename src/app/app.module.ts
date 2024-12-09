import { Module } from '@nestjs/common';
import { AppController, ApiController } from './app.controller';
import { AppService } from './app.service';
import { ConfigModule } from '@nestjs/config';
import { validate } from '../core/config/config.validator';
import { DatabaseModule } from '../core/database/database.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
      expandVariables: true,
      cache: true,
      load: [
        () => ({
          NODE_ENV: process.env.NODE_ENV || 'development',
          CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
          SUPABASE_URL: process.env.SUPABASE_URL || 'http://localhost:54321',
          SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY || 'test-service-key',
          SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET || 'test-jwt-secret',
          REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
        }),
      ],
    }),
    DatabaseModule,
  ],
  controllers: [AppController, ApiController],
  providers: [AppService],
})
export class AppModule {}
