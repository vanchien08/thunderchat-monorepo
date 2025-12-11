import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../configs/db/prisma.service'
import {
  EChatType,
  EProviderTokens,
  EPushNotificationType,
  ERoutes,
  ESyncDataToESWorkerType,
  Eurgency,
} from '@/utils/enums'
import type {
  TMessage,
  TMessageWithMedia,
  TMessageForGlobalSearch,
} from '@/utils/entities/message.entity'
import { EMessageStatus, EMessageTypes, ESortTypes } from '@/message/message.enum'
import dayjs from 'dayjs'
import type {
  TGetDirectMessagesData,
  TGetDirectMessagesMessage,
  TMessageOffset,
  TMessageUpdates,
} from './message.type'
import { SyncDataToESService } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.service'
@Injectable()
export class MessageService {
  private readonly messageFullInfo = {
    ReplyTo: {
      include: {
        Author: {
          include: {
            Profile: true,
          },
        },
        Media: true,
        Sticker: true,
      },
    },
    Author: {
      include: {
        Profile: true,
      },
    },
    Media: true,
    Sticker: true,
  }

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private PrismaService: PrismaService,
    private syncDataToESService: SyncDataToESService
  ) {}

  async fidMsgById(msgId: number): Promise<TMessage | null> {
    return await this.PrismaService.message.findUnique({
      where: { id: msgId },
      include: {
        ReplyTo: true,
      },
    })
  }

  createMessageContentForMedia(
    originalContent: string,
    stickerId?: number,
    mediaId?: number
  ): string {
    if (stickerId || mediaId) {
      return ''
    }
    return originalContent
  }

  async createNewMessage(
    encryptedContent: string,
    authorId: number,
    timestamp: Date,
    type: EMessageTypes = EMessageTypes.TEXT,
    recipientId?: number,
    stickerId?: number,
    mediaId?: number,
    replyToId?: number,
    directChatId?: number,
    groupChatId?: number
  ): Promise<null> {
    // const message = await this.PrismaService.message.create({
    //   data: {
    //     content: this.createMessageContentForMedia(encryptedContent, stickerId, mediaId),
    //     authorId,
    //     createdAt: timestamp,
    //     status: EMessageStatus.SENT,
    //     type,
    //     stickerId,
    //     recipientId,
    //     mediaId,
    //     replyToId,
    //     groupChatId,
    //     directChatId,
    //   },
    //   include: this.messageFullInfo,
    // })
    // this.syncDataToESService.syncDataToES({
    //   type: ESyncDataToESWorkerType.CREATE_MESSAGE,
    //   data: message,
    //   // msgEncryptor: this.syncDataToESService.getESMessageEncryptor(authorId),
    // })
    return null
  }

  async updateMsg(msgId: number, updates: TMessageUpdates): Promise<TMessageWithMedia> {
    const message = await this.PrismaService.message.update({
      where: { id: msgId },
      data: updates,
      include: {
        Media: true,
      },
    })
    this.syncDataToESService.syncDataToES({
      type: ESyncDataToESWorkerType.UPDATE_MESSAGE,
      data: message,
    })
    return message
  }

  async getNewerDirectMessages(
    messageOffset: TMessageOffset,
    directChatId: number | undefined,
    groupChatId: number | undefined,
    limit: number
  ): Promise<TGetDirectMessagesMessage[]> {
    const messages = await this.PrismaService.message.findMany({
      where: {
        id: {
          gt: messageOffset,
        },
        directChatId,
        groupChatId,
      },
      orderBy: {
        id: 'asc',
      },
      take: limit,
      include: this.messageFullInfo,
    })
    return messages
  }

  private sortFetchedMessages(
    messages: TGetDirectMessagesMessage[],
    sortType: ESortTypes
  ): TGetDirectMessagesMessage[] {
    const msgs = [...messages]
    switch (sortType) {
      case ESortTypes.TIME_ASC:
        msgs.sort((curr, next) => dayjs(curr.createdAt).valueOf() - dayjs(next.createdAt).valueOf())
        return msgs
    }
    return msgs
  }

  async getOlderDirectMessages(
    messageOffset: TMessageOffset | undefined,
    directChatId: number | undefined,
    groupChatId: number | undefined,
    limit: number,
    equalOffset: boolean
  ): Promise<TGetDirectMessagesMessage[]> {
    return await this.PrismaService.message.findMany({
      where: {
        id: {
          [equalOffset ? 'lte' : 'lt']: messageOffset,
        },
        directChatId,
        groupChatId,
      },
      orderBy: {
        id: 'desc',
      },
      take: limit,
      include: this.messageFullInfo,
    })
  }

  async getOlderDirectMessagesHandler(
    messageOffset: TMessageOffset | undefined,
    directChatId: number | undefined,
    groupChatId: number | undefined,
    limit: number,
    isFirstTime: boolean = false,
    sortType: ESortTypes = ESortTypes.TIME_ASC
  ): Promise<TGetDirectMessagesData> {
    const messages = await this.getOlderDirectMessages(
      messageOffset,
      directChatId,
      groupChatId,
      limit + 1,
      isFirstTime
    )
    let sortedMessages: TGetDirectMessagesMessage[] | null = null
    if (messages && messages.length > 0) {
      if (messages.length > limit) {
        sortedMessages = messages.slice(0, -1)
      } else {
        sortedMessages = messages
      }
      if (sortType) {
        sortedMessages = this.sortFetchedMessages(sortedMessages, sortType)
      }
    }
    return {
      hasMoreMessages: messages.length > limit,
      directMessages: sortedMessages || [],
    }
  }

  async updateMessageStatus(msgId: number, status: EMessageStatus): Promise<TMessage> {
    return await this.updateMsg(msgId, {
      status,
    })
  }

  async findMessagesForGlobalSearch(
    ids: number[],
    limit: number
  ): Promise<TMessageForGlobalSearch[]> {
    return await this.PrismaService.message.findMany({
      where: {
        id: { in: ids },
        isDeleted: { not: true },
      },
      include: {
        Media: true,
        Author: {
          include: {
            Profile: true,
          },
        },
        GroupChat: {
          include: {
            Members: {
              include: {
                User: {
                  include: {
                    Profile: true,
                  },
                },
              },
            },
          },
        },
      },
      take: limit,
    })
  }

  async getVoiceMessages(
    chatId: number,
    limit: number,
    offset: number,
    sortType: ESortTypes = ESortTypes.TIME_ASC
  ) {
    // Lấy chỉ voice messages
    const voiceMessages = await this.PrismaService.message.findMany({
      where: {
        OR: [{ directChatId: chatId }, { groupChatId: chatId }],
        type: EMessageTypes.MEDIA,
        mediaId: {
          not: null,
        },
      },
      orderBy: {
        createdAt: sortType === ESortTypes.TIME_ASC ? 'asc' : 'desc',
      },
      take: limit,
      skip: offset,
    })

    return {
      hasMoreMessages: voiceMessages.length === limit,
      directMessages: voiceMessages,
    }
  }

  async getMessageContext(messageId: number) {
    // 1. Lấy tin nhắn trung tâm (tin nhắn muốn dẫn tới)
    const centerMsg = await this.PrismaService.message.findUnique({
      where: { id: messageId },
      include: this.messageFullInfo,
    })
    if (!centerMsg) {
      throw new Error('Message not found')
    }

    // 2. Lấy 10 tin nhắn trước
    const prevMsgs = await this.PrismaService.message.findMany({
      where: {
        directChatId: centerMsg.directChatId,
        createdAt: { lt: centerMsg.createdAt },
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: this.messageFullInfo,
    })
    // 3. Lấy 10 tin nhắn sau
    const nextMsgs = await this.PrismaService.message.findMany({
      where: {
        directChatId: centerMsg.directChatId,
        createdAt: { gt: centerMsg.createdAt },
      },
      orderBy: { createdAt: 'asc' },
      take: 10,
      include: this.messageFullInfo,
    })

    // 4. Ghép lại đúng thứ tự thời gian
    const messages: (TGetDirectMessagesMessage & { isLastMsgInList?: boolean })[] = [
      ...prevMsgs.reverse(),
      centerMsg,
      ...nextMsgs,
    ]
    // 5. Đánh dấu isLastMsgInList cho tin cuối cùng
    if (messages.length > 0) {
      messages[messages.length - 1].isLastMsgInList = true
    }

    return messages
  }
}
