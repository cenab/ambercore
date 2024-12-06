import { Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BaseConfig } from '../interfaces/config.interface';

export abstract class BaseService implements OnModuleInit, OnModuleDestroy {
  protected readonly logger: Logger;
  protected readonly config: BaseConfig;

  constructor(context: string, config: BaseConfig) {
    this.logger = new Logger(context);
    this.config = {
      enabled: true,
      debug: false,
      ...config,
    };

    if (this.config.debug) {
      this.logger.debug('Service initialized with config:', this.config);
    }
  }

  async onModuleInit(): Promise<void> {
    if (!this.config.enabled) {
      this.logger.warn('Service is disabled');
      return;
    }

    try {
      await this.initialize();
      this.logger.log('Service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize service:', error);
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      await this.cleanup();
      this.logger.log('Service cleaned up successfully');
    } catch (error) {
      this.logger.error('Failed to cleanup service:', error);
      throw error;
    }
  }

  protected abstract initialize(): Promise<void>;
  protected abstract cleanup(): Promise<void>;

  protected handleError(error: Error, context?: string): never {
    const message = context ? `[${context}] ${error.message}` : error.message;
    this.logger.error(message);
    throw error;
  }

  protected async withRetry<T>(
    operation: () => Promise<T>,
    options: {
      retries?: number;
      delay?: number;
      context?: string;
    } = {}
  ): Promise<T> {
    const { retries = 3, delay = 1000, context } = options;
    let lastError: Error;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        if (attempt < retries) {
          this.logger.warn(
            `${context ? `[${context}] ` : ''}Attempt ${attempt} failed, retrying in ${delay}ms...`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw this.handleError(
      lastError!,
      context ? `${context} (after ${retries} attempts)` : `Failed after ${retries} attempts`
    );
  }

  protected isHealthy(): Promise<boolean> {
    return Promise.resolve(true);
  }
} 