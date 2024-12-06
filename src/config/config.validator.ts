import { plainToClass } from 'class-transformer';
import { IsString, IsNotEmpty, validateSync } from 'class-validator';

class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_KEY: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL: string;

  @IsString()
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
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
