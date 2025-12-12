import { Controller } from '@nestjs/common'
import { GrpcMethod, RpcException } from '@nestjs/microservices'
import { MessageService } from './message.service'
import type { IMessageGrpcController } from './message.interface'
import type {
  TGetNewerDirectMessagesRequest,
  TCreateNewMessageRequest,
  TUpdateMessageStatusRequest,
  TFindMessagesForGlobalSearchRequest,
} from './message.type'
import { EMessageTypes } from './message.enum'
import { EGrpcServices, EMessageStatus } from '@/utils/enums'
import { status } from '@grpc/grpc-js'
import { EMsgMessages } from './message.message'
import { convertGrpcTimestampToDate } from '@/utils/helpers'

@Controller()
export class MessageGrpcController implements IMessageGrpcController {
  constructor(private readonly messageService: MessageService) {}

  @GrpcMethod(EGrpcServices.MESSAGE_SERVICE, 'GetNewerDirectMessages')
  async getNewerDirectMessages(request: TGetNewerDirectMessagesRequest) {
    const messages = await this.messageService.getNewerDirectMessages(
      request.messageOffset,
      request.directChatId,
      request.groupChatId,
      request.limit
    )

    return {
      messages,
    }
  }

  @GrpcMethod(EGrpcServices.MESSAGE_SERVICE, 'CreateNewMessage')
  async createNewMessage(request: TCreateNewMessageRequest) {
    const { type, timestamp } = request
    if (!timestamp) {
      throw new RpcException({
        code: status.INVALID_ARGUMENT,
        message: EMsgMessages.TIMESTAMP_REQUIRED,
      })
    }
    const newMessage = await this.messageService.createNewMessage(
      request.encryptedContent,
      request.authorId,
      convertGrpcTimestampToDate(timestamp.seconds, timestamp.nanos),
      type as EMessageTypes,
      request.recipientId,
      request.stickerId,
      request.mediaId,
      request.replyToId,
      request.directChatId,
      request.groupChatId
    )

    return {
      newMessageJson: JSON.stringify(newMessage),
    }
  }

  @GrpcMethod(EGrpcServices.MESSAGE_SERVICE, 'UpdateMessageStatus')
  async updateMessageStatus(request: TUpdateMessageStatusRequest) {
    const status = request.status
    const message = await this.messageService.updateMessageStatus(
      request.msgId,
      status as EMessageStatus
    )

    return {
      messageJson: JSON.stringify(message),
    }
  }

  @GrpcMethod(EGrpcServices.MESSAGE_SERVICE, 'FindMessagesForGlobalSearch')
  async findMessagesForGlobalSearch(request: TFindMessagesForGlobalSearchRequest) {
    const messages = await this.messageService.findMessagesForGlobalSearch(
      request.ids,
      request.limit
    )

    return {
      messagesJson: messages.map((msg) => JSON.stringify(msg)),
    }
  }
}
