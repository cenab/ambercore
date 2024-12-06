import { Logger } from '@nestjs/common';
import { ApiResponse, ApiError, PaginatedResponse, PaginationMeta } from '../types/api.types';

export abstract class BaseController {
  protected readonly logger: Logger;

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  protected success<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      timestamp: new Date().toISOString(),
      ...(message && { message }),
    };
  }

  protected error(error: Error | string, code?: string): ApiResponse {
    const errorMessage = error instanceof Error ? error.message : error;
    const errorResponse: ApiError = {
      code: code || 'INTERNAL_ERROR',
      message: errorMessage,
    };

    this.logger.error(errorMessage);

    return {
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    };
  }

  protected paginate<T>(
    data: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResponse<T> {
    const meta: PaginationMeta = {
      total,
      page,
      limit,
      hasMore: total > page * limit
    };

    return {
      success: true,
      data,
      meta,
      timestamp: new Date().toISOString(),
    };
  }
} 