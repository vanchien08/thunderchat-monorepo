import { Controller } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import { DirectChatService } from './direct-chat.service'
import type { IDirectChatGrpcService } from './direct-chat.interface'
import type {
  TFindConversationWithOtherUserRequest,
  TCreateNewDirectChatRequest,
  TUpdateLastSentMessageRequest,
  TFindDirectChatByIdRequest,
} from './direct-chat.type'
import { EGrpcServices } from '@/utils/enums'

@Controller()
export class DirectChatGrpcController implements IDirectChatGrpcService {
  constructor(private readonly directChatService: DirectChatService) {}

  @GrpcMethod(EGrpcServices.DIRECT_CHAT_SERVICE, 'FindConversationWithOtherUser')
  async findConversationWithOtherUser(request: TFindConversationWithOtherUserRequest) {
    const directChat = await this.directChatService.findConversationWithOtherUser(
      request.userId,
      request.otherUserId
    )

    return {
      directChatJson: JSON.stringify(directChat),
    }
  }

  @GrpcMethod(EGrpcServices.DIRECT_CHAT_SERVICE, 'CreateNewDirectChat')
  async createNewDirectChat(request: TCreateNewDirectChatRequest) {
    const newDirectChat = await this.directChatService.createNewDirectChat(
      request.creatorId,
      request.recipientId
    )

    return {
      newDirectChatJson: JSON.stringify(newDirectChat),
    }
  }

  @GrpcMethod(EGrpcServices.DIRECT_CHAT_SERVICE, 'UpdateLastSentMessage')
  async updateLastSentMessage(request: TUpdateLastSentMessageRequest) {
    await this.directChatService.updateDirectChat(request.directChatId, {
      lastSentMessageId: request.lastSentMessageId,
    })
  }

  @GrpcMethod(EGrpcServices.DIRECT_CHAT_SERVICE, 'findById')
  async findById(request: TFindDirectChatByIdRequest) {
    const directChat = await this.directChatService.findById(request.directChatId)

    return {
      directChatJson: directChat ? JSON.stringify(directChat) : undefined,
    }
  }
}
