import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    // Get the error response from the exception
    let errorResponse: any = exception instanceof HttpException
      ? exception.getResponse()
      : { message: exception.message };

    // If it's a string, convert it to an object
    if (typeof errorResponse === 'string') {
      errorResponse = { message: errorResponse };
    }

    const responseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      correlationId: request.headers['x-correlation-id'],
      requestId: request.headers['x-request-id'],
      error: {
        name: exception.name,
        message: process.env.NODE_ENV === 'production' && status === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal server error'
          : errorResponse.message,
        ...(Array.isArray(errorResponse.message)
          ? { details: errorResponse.message }
          : {}),
        ...(exception.stack && process.env.NODE_ENV !== 'production'
          ? { stack: exception.stack.split('\n') }
          : {}),
        ...(errorResponse.metadata || {}),
      },
    };

    // Log the error
    this.logger.error(
      `Request failed: ${request.method} ${request.url}`,
      {
        statusCode: status,
        correlationId: request.headers['x-correlation-id'],
        requestId: request.headers['x-request-id'],
        error: exception,
      },
    );

    // Send the response
    response
      .status(status)
      .json(responseBody);
  }
} 