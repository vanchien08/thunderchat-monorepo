import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common'
import { Observable } from 'rxjs'
import { SymmetricEncryptor } from '@/utils/crypto/symmetric-encryption.crypto'
import { SyncDataToESService } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.service'
import { EMessagingListenSocketEvents } from '../utils/events/socket.event'
import { EMessageTypes } from '@/message/message.enum'
import { BaseWsException } from '@/utils/exceptions/base-ws.exception'
import type { TClientSocket } from '@/utils/events/event.type'
import { EGatewayMessages } from './messaging.message'
import { EMsgEncryptionAlgorithms } from '@/utils/enums'
import { DevLogger } from '@/dev/dev-logger'

@Injectable()
export class MessagingGatewayInterceptor implements NestInterceptor {
  private readonly msgEncryptor: SymmetricEncryptor

  constructor(private readonly syncDataToESService: SyncDataToESService) {
    this.msgEncryptor = new SymmetricEncryptor(EMsgEncryptionAlgorithms.AES_256_ECB)
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const client = context.switchToWs().getClient<TClientSocket>()
    const event = context.switchToWs().getPattern() as EMessagingListenSocketEvents
    const data = context.switchToWs().getData()

    DevLogger.logForWebsocket('Got an EVENT:', { event, data })
    // this.handleEncryptMessageContent(client, event, data)

    return next.handle()
  }

  private handleEncryptMessageContent(
    client: TClientSocket,
    event: EMessagingListenSocketEvents,
    data: any
  ): void {
    // Chỉ xử lý sự kiện gửi tin nhắn 1-1
    if (event !== EMessagingListenSocketEvents.send_message_direct) return

    // Validate message type và content
    if (!data || typeof data !== 'object') {
      throw new BaseWsException(EGatewayMessages.INVALID_MESSAGE_FORMAT)
    }

    const { type, msgPayload } = data
    if (!type || !msgPayload || typeof msgPayload !== 'object') {
      throw new BaseWsException(EGatewayMessages.INVALID_MESSAGE_FORMAT)
    }

    // Chỉ mã hóa nếu là message text
    if (type === EMessageTypes.TEXT && msgPayload.content) {
      const userId = client.handshake.auth.userId
      if (!userId) {
        throw new BaseWsException(EGatewayMessages.UNAUTHORIZED)
      }

      // Lấy khóa mã hóa từ SyncDataToESService
      const secretKey = this.syncDataToESService.getUserSecretKey(userId)
      if (!secretKey) {
        throw new BaseWsException(EGatewayMessages.MESSAGE_ENCRYPTOR_NOT_SET)
      }

      // Mã hóa nội dung message
      try {
        msgPayload.content = this.msgEncryptor.encrypt(msgPayload.content, secretKey)
      } catch (error) {
        throw new BaseWsException(EGatewayMessages.MESSAGE_ENCRYPTION_FAILED)
      }
    }
  }
}
