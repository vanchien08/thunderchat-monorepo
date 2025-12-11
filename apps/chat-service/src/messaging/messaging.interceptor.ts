import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { EMessagingListenSocketEvents } from '../utils/events/socket.event'
import type { TClientSocket } from '@/utils/events/event.type'
import { DevLogger } from '@/dev/dev-logger'

@Injectable()
export class MessagingGatewayInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const client = context.switchToWs().getClient<TClientSocket>()
    const event = context.switchToWs().getPattern() as EMessagingListenSocketEvents
    const data = context.switchToWs().getData()

    DevLogger.logForWebsocket('Got an EVENT:', { event, data, clientAuth: client.handshake.auth })

    return next.handle()
  }
}
