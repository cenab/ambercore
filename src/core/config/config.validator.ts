import { plainToClass } from 'class-transformer';
import { IsString, IsUrl, IsNumber, IsBoolean, IsOptional, IsIn, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsIn(['development', 'production', 'test'])
  NODE_ENV: string;

  @IsUrl({
    require_tld: false,
    require_protocol: true,
    protocols: ['http', 'https']
  })
  SUPABASE_URL: string;

  @IsString()
  SUPABASE_SERVICE_KEY: string;

  @IsString()
  SUPABASE_JWT_SECRET: string;

  @IsString()
  REDIS_URL: string;

  @IsString()
  CORS_ORIGIN: string;

  // Kafka Configuration
  @IsOptional()
  @IsString()
  KAFKA_REST_URL?: string;

  @IsOptional()
  @IsString()
  KAFKA_REST_TOKEN?: string;

  // Metrics and Logging
  @IsOptional()
  @IsString()
  @IsIn(['error', 'warn', 'info', 'debug', 'verbose'])
  LOG_LEVEL?: string = 'info';

  @IsOptional()
  @IsBoolean()
  ENABLE_METRICS?: boolean = false;

  @IsOptional()
  @IsNumber()
  METRICS_PORT?: number = 9090;

  // Circuit Breaker Configuration
  @IsOptional()
  @IsNumber()
  CIRCUIT_BREAKER_TIMEOUT?: number = 3000;

  @IsOptional()
  @IsNumber()
  CIRCUIT_BREAKER_ERROR_THRESHOLD?: number = 50;

  @IsOptional()
  @IsNumber()
  CIRCUIT_BREAKER_RESET_TIMEOUT?: number = 30000;

  // API Configuration
  @IsOptional()
  @IsNumber()
  API_TIMEOUT?: number = 10000;

  @IsOptional()
  @IsNumber()
  API_RATE_LIMIT?: number = 100;

  @IsOptional()
  @IsNumber()
  API_RATE_LIMIT_WINDOW?: number = 60000;

  // Cache Configuration
  @IsOptional()
  @IsNumber()
  CACHE_TTL?: number = 60;

  @IsOptional()
  @IsNumber()
  CACHE_MAX_ITEMS?: number = 1000;

  // Security
  @IsOptional()
  @IsString()
  JWT_SECRET?: string;

  @IsOptional()
  @IsString()
  JWT_EXPIRES_IN?: string = '1h';

  @IsOptional()
  @IsString()
  COOKIE_SECRET?: string;

  // Test Configuration
  @IsOptional()
  @IsNumber()
  TEST_TIMEOUT?: number = 30000;

  @IsOptional()
  @IsString()
  TEST_DATABASE_URL?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(
    EnvironmentVariables,
    config,
    { enableImplicitConversion: true },
  );
  const errors = validateSync(validatedConfig, { skipMissingProperties: true });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
