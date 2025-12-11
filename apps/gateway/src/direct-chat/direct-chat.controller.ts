import { AuthGuard } from '@/auth/auth.guard'
import { DirectChatService } from '@/direct-chat/direct-chat.service'
import {
  Controller,
  Get,
  UseGuards,
  Param,
  Query,
  NotFoundException,
  Body,
  Post,
  Delete,
} from '@nestjs/common'
import { ERoutes } from '@/utils/enums'
import { IDirectChatsController } from './direct-chat.interface'
import {
  FetchDirectChatDTO,
  FetchDirectChatsDTO,
  CreateDirectChatDTO,
  FindConversationWithOtherUserDTO,
  DeleteDirectChatDTO,
} from './direct-chat.dto'
import { User } from '@/user/user.decorator'
import { TUserWithProfile } from '@/utils/entities/user.entity'
import { EDirectChatMessages } from './direct-chat.message'

@Controller(ERoutes.DIRECT_CHAT)
@UseGuards(AuthGuard)
export class DirectChatController implements IDirectChatsController {
  constructor(private directChatService: DirectChatService) {}

  @Get('fetch/:conversationId')
  async fetchDirectChat(@Param() params: FetchDirectChatDTO, @User() user: TUserWithProfile) {
    const directChat = await this.directChatService.findByDirectChatIdAndUserId(
      params.conversationId,
      user.id
    )
    if (!directChat) {
      throw new NotFoundException(EDirectChatMessages.DIRECT_CHAT_NOT_FOUND)
    }
    return directChat
  }

  // fetch all direct chats of user
  @Get('fetch-direct-chats')
  async fetchAllDirectChats(@Query() query: FetchDirectChatsDTO, @User() user: TUserWithProfile) {
    const directChats = await this.directChatService.findDirectChatsByUser(
      user.id,
      query.lastId,
      query.limit
    )
    return directChats
  }

  @Get('find-conversation-with-other-user/:otherUserId')
  async findConversationWithOtherUser(
    @Param() params: FindConversationWithOtherUserDTO,
    @User() user: TUserWithProfile
  ) {
    const conversation = await this.directChatService.findConversationWithOtherUser(
      user.id,
      params.otherUserId
    )
    return conversation
  }

  @Delete('delete-direct-chat')
  async deleteDirectChat(@Query() query: DeleteDirectChatDTO, @User() user: TUserWithProfile) {
    const { directChatId } = query
    await this.directChatService.deleteDirectChat(directChatId, user)
    return {
      success: true,
    }
  }
}
