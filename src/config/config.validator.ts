import { plainToClass, Transform } from 'class-transformer';
import { IsString, IsNotEmpty, IsEnum, validateSync } from 'class-validator';

enum Environment {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

export class EnvironmentVariables {
  @IsString()
  @IsNotEmpty()
  SUPABASE_URL!: string;

  @IsString()
  @IsNotEmpty()
  SUPABASE_SERVICE_KEY!: string;

  @IsString()
  @IsNotEmpty()
  REDIS_URL!: string;

  @IsEnum(Environment)
  @Transform(({ value }) => value as Environment)
  NODE_ENV!: Environment;

  @IsString()
  @IsNotEmpty()
  SUPABASE_JWT_SECRET!: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToClass(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    console.error('Environment validation errors:', errors);
    throw new Error(errors.toString());
  }
  return validatedConfig;
}
