import { plainToClass } from 'class-transformer';
import { IsString, IsNotEmpty, validateSync, Matches } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  @Matches(/^https?:\/\/.+\.supabase\.co$/, {
    message: 'SUPABASE_URL must be a valid Supabase URL',
  })
  SUPABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^eyJ.*$/, {
    message: 'SUPABASE_SERVICE_KEY must be a valid JWT token',
  })
  SUPABASE_SERVICE_KEY: string;

  @IsString()
  @IsNotEmpty()
  @Matches(/^redis:\/\/.+$/, {
    message: 'REDIS_URL must be a valid Redis URL',
  })
  REDIS_URL: string;

  @IsString()
  @Matches(/^(development|production|test)$/)
  NODE_ENV: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_JWT_SECRET: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config);
  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    console.error('Environment validation errors:', errors);
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
