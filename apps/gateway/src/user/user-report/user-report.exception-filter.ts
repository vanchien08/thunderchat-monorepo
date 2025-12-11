import { ExceptionFilter, Catch, ArgumentsHost, BadRequestException } from '@nestjs/common'
import { Response } from 'express'

@Catch(BadRequestException)
export class UserReportExceptionFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const status = exception.getStatus()
    const exceptionResponse = exception.getResponse() as any

    // Check if this is a validation error from DTO
    if (exceptionResponse.message && Array.isArray(exceptionResponse.message)) {
      // This is a validation error, return JSON response
      const errorMessage = exceptionResponse.message[0] || 'Validation failed'

      response.status(200).json({
        success: false,
        error: errorMessage,
        code: 'VALIDATION_ERROR',
        details: {
          validationErrors: exceptionResponse.message,
        },
      })
    } else {
      // This is a regular BadRequestException, return JSON response
      response.status(200).json({
        success: false,
        error: exceptionResponse.message || 'Bad request',
        code: 'BAD_REQUEST',
        details: {
          originalError: exceptionResponse.message,
        },
      })
    }
  }
}
