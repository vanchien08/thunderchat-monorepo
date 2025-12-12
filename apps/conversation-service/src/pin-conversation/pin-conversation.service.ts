import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@/configs/db/prisma.service'
import { TTogglePinConversationRes } from './pin-conversation.type'
import { EPinConversationMessages } from './pin-conversation.message'
import { TPinnedChat } from '@/utils/entities/pinned-chat.entity'
import { EProviderTokens } from '@/utils/enums'

@Injectable()
export class PinConversationService {
  private readonly MAX_PINNED_CHATS: number = 5

  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService) {}

  async togglePinConversation(
    userId: number,
    directChatId?: number,
    groupChatId?: number
  ): Promise<TTogglePinConversationRes> {
    if (directChatId && groupChatId) {
      throw new BadRequestException(
        EPinConversationMessages.CANNOT_PIN_OR_UNPIN_DIRECT_OR_GROUP_CHAT
      )
    }
    if (!directChatId && !groupChatId) {
      throw new BadRequestException(EPinConversationMessages.INVALID_PARAMS)
    }
    const pinnedChat = await this.prismaService.pinnedChat.findFirst({
      where: {
        ...(directChatId && { directChatId }),
        ...(groupChatId && { groupChatId }),
        pinnedBy: userId,
      },
    })
    if (pinnedChat) {
      await this.prismaService.pinnedChat.delete({
        where: {
          id: pinnedChat.id,
        },
      })
    } else {
      const pinnedChatsCount = await this.prismaService.pinnedChat.count({
        where: {
          pinnedBy: userId,
        },
      })
      if (pinnedChatsCount >= this.MAX_PINNED_CHATS) {
        throw new BadRequestException(EPinConversationMessages.MAX_PINNED_CHATS_REACHED)
      }
      await this.prismaService.pinnedChat.create({
        data: {
          ...(directChatId && { directChatId }),
          ...(groupChatId && { groupChatId }),
          pinnedBy: userId,
        },
      })
    }
    return {
      success: true,
      isPinned: !pinnedChat,
    }
  }

  async getPinnedChatsByUser(userId: number): Promise<TPinnedChat[]> {
    const pinnedChats = await this.prismaService.pinnedChat.findMany({
      where: {
        pinnedBy: userId,
      },
    })
    return pinnedChats
  }
}
