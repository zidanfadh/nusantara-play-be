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
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    const errorResponse = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      message:
        typeof message === 'string'
          ? message
          : (message as any).message || message,
    };

    // Log the error for debugging
    // Only name, message and stack: never the whole object, which for a
    // QueryFailedError includes the query parameters and the driver's detail
    // (personal data such as emails or phone numbers) (P2).
    if (status === HttpStatus.INTERNAL_SERVER_ERROR) {
      if (exception instanceof Error) {
        this.logger.error(
          `Unhandled ${exception.name} on ${request.method} ${request.path ?? request.url}: ${exception.message}`,
          exception.stack,
        );
      } else {
        this.logger.error(
          `Unhandled non-Error exception (${typeof exception}) on ${request.method} ${request.path ?? request.url}`,
        );
      }
    }

    response.status(status).json(errorResponse);
  }
}
