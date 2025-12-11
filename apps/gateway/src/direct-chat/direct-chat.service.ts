import type {
  TFetchDirectChatsData,
  TFindDirectChatData,
  TUpdateDirectChatData,
} from './direct-chat.type'
import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '@/configs/db/prisma.service'
import { EInternalEvents, EProviderTokens, ESyncDataToESWorkerType } from '@/utils/enums'
import { Prisma } from '@prisma/client'
import type { TDirectChat } from '@/utils/entities/direct-chat.entity'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { SyncDataToESService } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.service'

@Injectable()
export class DirectChatService {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private PrismaService: PrismaService,
    private eventEmitter: EventEmitter2,
    private syncDataToESService: SyncDataToESService
  ) {}

  async findById(id: number): Promise<TDirectChat | null> {
    return await this.PrismaService.directChat.findUnique({
      where: { id },
    })
  }

  async findByDirectChatIdAndUserId(
    id: number,
    userId: number
  ): Promise<TFindDirectChatData | null> {
    return await this.PrismaService.directChat.findUnique({
      where: { id, OR: [{ creatorId: userId }, { recipientId: userId }] },
      include: {
        Recipient: {
          include: {
            Profile: true,
          },
        },
        Creator: {
          include: {
            Profile: true,
          },
        },
      },
    })
  }

  async updateDirectChat(directChatId: number, updates: TUpdateDirectChatData): Promise<void> {
    await this.PrismaService.directChat.update({
      where: { id: directChatId },
      data: updates,
    })
  }

  async updateLastSentMessage(directChatId: number, lastSentMessageId: number): Promise<void> {
    await this.updateDirectChat(directChatId, { lastSentMessageId })
  }

  async findDirectChatsByUser(
    userId: number,
    lastId?: number,
    limit: number = 20
  ): Promise<TFetchDirectChatsData[]> {
    // Lấy các direct chat mà user là creator hoặc recipient
    const findCondition: Prisma.DirectChatWhereInput = {
      OR: [{ creatorId: userId }, { recipientId: userId }],
    }
    if (lastId) {
      // Giả sử muốn lấy các direct chat có id < lastId (phân trang lùi)
      findCondition.id = { lt: lastId }
    }
    return await this.PrismaService.directChat.findMany({
      where: findCondition,
      orderBy: [{ LastSentMessage: { createdAt: 'desc' } }, { id: 'desc' }],
      take: limit,
      include: {
        LastSentMessage: true,
        Recipient: {
          include: { Profile: true },
        },
        Creator: {
          include: { Profile: true },
        },
      },
    })
  }

  async findConversationWithOtherUser(
    userId: number,
    otherUserId: number
  ): Promise<TDirectChat | null> {
    const conversation = await this.PrismaService.directChat.findFirst({
      where: {
        OR: [
          { creatorId: userId, recipientId: otherUserId },
          { creatorId: otherUserId, recipientId: userId },
        ],
      },
    })
    return conversation
  }

  async createNewDirectChat(creatorId: number, recipientId: number): Promise<TDirectChat> {
    const conversation = await this.PrismaService.directChat.create({
      data: {
        creatorId,
        recipientId,
      },
    })
    return conversation
  }

  async deleteDirectChat(directChatId: number, deleter: TUserWithProfile): Promise<void> {
    // xóa direct chat và toàn bộ tin nhắn trong direct chat (dùng transaction)
    await this.PrismaService.$transaction(async (tx) => {
      await Promise.all([
        tx.pinnedMessage.deleteMany({
          where: { directChatId },
        }),
        tx.pinnedChat.deleteMany({
          where: { directChatId },
        }),
        tx.messageMedia.deleteMany({
          where: { Message: { some: { directChatId } } },
        }),
      ])
      const messages = await tx.message.findMany({
        where: { directChatId },
        select: {
          id: true,
        },
      })
      await tx.message.deleteMany({
        where: { directChatId },
      })
      this.syncDataToESService.syncDataToES({
        type: ESyncDataToESWorkerType.DELETE_MESSAGES_IN_BULK,
        data: messages.map(({ id }) => id),
      })
      await tx.directChat.delete({
        where: { id: directChatId },
      })
    })
    this.eventEmitter.emit(EInternalEvents.DELETE_DIRECT_CHAT, directChatId, deleter)
  }
}
