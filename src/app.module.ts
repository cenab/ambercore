import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { MetricsModule } from './metrics/metrics.module';
import { CacheModule } from './cache/cache.module';
import { UsersModule } from './users/users.module';
import { HealthModule } from './health/health.module';
import { validate } from './config/config.validator';

@Module({
  imports: [
    ConfigModule.forRoot({
      validate,
      isGlobal: true,
    }),
    AuthModule,
    DatabaseModule,
    MetricsModule,
    CacheModule,
    UsersModule,
    HealthModule,
  ],
})
export class AppModule {}
