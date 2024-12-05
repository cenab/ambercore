import { Injectable } from '@nestjs/common';

@Injectable()
export class ConfigValidator {
  static validate() {
    const requiredEnvVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_KEY',
      'REDIS_URL',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (envVar) => !process.env[envVar],
    );

    if (missingEnvVars.length > 0) {
      throw new Error(
        `Missing required environment variables: ${missingEnvVars.join(', ')}`,
      );
    }
  }
} 