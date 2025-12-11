import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common'
import { Response } from 'express'

@Catch()
export class AdminExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()

    let status = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let code = 'INTERNAL_ERROR'

    if (exception instanceof HttpException) {
      status = exception.getStatus()
      const exceptionResponse = exception.getResponse() as any

      // Handle validation errors
      if (status === HttpStatus.BAD_REQUEST) {
        if (Array.isArray(exceptionResponse.message)) {
          message = 'Validation failed'
          code = 'VALIDATION_ERROR'
        } else {
          message = exceptionResponse.message || 'Bad request'
          code = 'BAD_REQUEST'
        }
      } else {
        message = exceptionResponse.message || exception.message
        code = this.getErrorCode(status)
      }
    } else if (exception instanceof Error) {
      message = exception.message
      code = 'UNKNOWN_ERROR'
    }

    const errorResponse = {
      success: false,
      error: message,
      code: code,
      timestamp: new Date().toISOString(),
      path: ctx.getRequest().url,
    }

    response.status(status).json(errorResponse)
  }

  private getErrorCode(status: number): string {
    switch (status) {
      case HttpStatus.UNAUTHORIZED:
        return 'UNAUTHORIZED'
      case HttpStatus.FORBIDDEN:
        return 'FORBIDDEN'
      case HttpStatus.NOT_FOUND:
        return 'NOT_FOUND'
      case HttpStatus.CONFLICT:
        return 'CONFLICT'
      case HttpStatus.UNPROCESSABLE_ENTITY:
        return 'UNPROCESSABLE_ENTITY'
      case HttpStatus.TOO_MANY_REQUESTS:
        return 'RATE_LIMIT_EXCEEDED'
      default:
        return 'HTTP_ERROR'
    }
  }
}
