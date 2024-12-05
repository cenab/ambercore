import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigValidator {
  static validate(config: Record<string, any>): Record<string, any> {
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'REDIS_URL',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar] && !config[envVar],
    );

    if (missingEnvVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingEnvVars.join(', ')}`,
      );
    }

    return config;
  }
} 