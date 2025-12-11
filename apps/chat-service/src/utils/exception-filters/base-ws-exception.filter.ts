import { BaseWsException } from '@/utils/exceptions/base-ws.exception'
import { Catch, ArgumentsHost, HttpStatus } from '@nestjs/common'
import { BaseWsExceptionFilter, WsException } from '@nestjs/websockets'
import { EMessagingEmitSocketEvents } from '@/utils/events/socket.event'
import type { TWsErrorResponse } from '../types'
import { Prisma } from '@prisma/client'
import type { TClientSocket } from '@/utils/events/event.type'

@Catch(WsException)
export class BaseWsExceptionsFilter extends BaseWsExceptionFilter {
  catch(exception: WsException, host: ArgumentsHost) {
    console.error('>>> ws exception:', exception)

    const clientSocket = host.switchToWs().getClient<TClientSocket>()
    const formattedException = this.formatException(exception)
    clientSocket.emit(EMessagingEmitSocketEvents.error, formattedException)
    super.catch(exception, host)
  }

  private formatException(exception: WsException): TWsErrorResponse {
    const toReturn: TWsErrorResponse = {
      message: exception.message,
      httpStatus: HttpStatus.INTERNAL_SERVER_ERROR,
      isError: true,
    }
    if (exception instanceof BaseWsException) {
      toReturn.httpStatus = exception.status
    }
    return toReturn
  }
}

function handleSetErrorMessage(error: Prisma.PrismaClientKnownRequestError | Error): string {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002': // Unique constraint failed
        const target = (error.meta?.target as string[])?.join(', ')
        return `Value already exists for field: ${target}`
      default:
        return `Database error (code: ${error.code})`
    }
  } else if (error instanceof Error) {
    return error.message
  }
  return 'Unknown error'
}

// catch socket exceptions at methods level
export function CatchInternalSocketError() {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value
    descriptor.value = async function (...args: any[]): Promise<TWsErrorResponse> {
      try {
        // call original function
        return await originalMethod.apply(this, args)
      } catch (error) {
        console.error('>>> Caught WS error:', error)

        let clientMessage = handleSetErrorMessage(error)
        let httpStatus = error.status || 500

        return {
          isError: true,
          message: clientMessage,
          httpStatus,
        }
      }
    }
    return descriptor
  }
}
