import { Injectable, Inject, BadRequestException } from '@nestjs/common'
import { PrismaService } from '../../configs/db/prisma.service'
import {
  EGrpcPackages,
  EGrpcServices,
  EProviderTokens,
  ESyncDataToESWorkerType,
} from '@/utils/enums'
import { EMessageMediaTypes, EMessageTypes } from '../message.enum'
import type { TMessageWithMedia } from '@/utils/entities/message.entity'
import { EPinMessages } from './pin.message'
import { GroupMemberService } from '@/group-member/group-member.service'
import { GroupChatService } from '@/group-chat/group-chat.service'
import { EGroupChatPermissions, EGroupChatRoles } from '@/group-chat/group-chat.enum'
import { EGroupMemberMessages } from '@/group-member/group-member.message'
import { ClientGrpc } from '@nestjs/microservices'
import { EMessagingEmitSocketEvents } from '@/utils/events/socket.event'
import { ElasticSearchService } from '@/configs/communication/grpc/services/es.service'
import { UserConnectionService } from '@/configs/communication/grpc/services/user-connection.service'
import { EncryptMessageService } from '../security/encrypt-message.service'
import { MessageService } from '../message.service'

@Injectable()
export class PinService {
  private syncDataToESService: ElasticSearchService
  private userConnectionService: UserConnectionService
  private pinMessageDescText: string = ' has pinned the message: '
  private unpinMessageDescText: string = ' has unpinned the message: '

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService,
    private groupChatService: GroupChatService,
    private groupMemberService: GroupMemberService,
    private encryptMessageService: EncryptMessageService,
    @Inject(EGrpcPackages.SEARCH_PACKAGE)
    private readonly elasticSearchClient: ClientGrpc,
    @Inject(EGrpcPackages.CHAT_PACKAGE)
    private readonly userConnectionGrpcClient: ClientGrpc,
    private messageService: MessageService
  ) {
    this.syncDataToESService = new ElasticSearchService(
      this.elasticSearchClient.getService(EGrpcServices.ELASTIC_SEARCH_SERVICE)
    )
    this.userConnectionService = new UserConnectionService(
      this.userConnectionGrpcClient.getService(EGrpcServices.USER_CONNECTION_SERVICE)
    )
  }

  // Helper mô tả nội dung tin nhắn
  getMessageDescription(message: TMessageWithMedia): string {
    switch (message.Media?.type) {
      case EMessageMediaTypes.IMAGE:
        return 'hình ảnh'
      case EMessageMediaTypes.VIDEO:
        return 'video'
      case EMessageMediaTypes.DOCUMENT:
        return message.Media?.fileName ? `file: ${message.Media.fileName}` : 'file'
      case EMessageMediaTypes.AUDIO:
        return 'audio'
    }
    switch (message.type) {
      case EMessageTypes.STICKER:
        return 'sticker'
      case EMessageTypes.TEXT:
        return message.content
    }
    return message.content
  }

  /**
   * Ghim hoặc bỏ ghim tin nhắn trong direct chat (đồng bộ cho tất cả user)
   * @param messageId ID của tin nhắn
   * @param directChatId ID của cuộc trò chuyện
   * @param userId ID của user thực hiện hành động (để ghi nhận và socket event)
   * @param isPinned Trạng thái ghim (true: ghim, false: bỏ ghim)
   */
  async pinOrUnpinMessage(
    messageId: number,
    directChatId: number,
    userId: number,
    isPinned: boolean
  ) {
    if (isPinned) {
      // Kiểm tra tin nhắn đã được ghim chưa
      const existingPin = await this.prismaService.pinnedMessage.findFirst({
        where: { messageId, directChatId },
      })
      if (existingPin) {
        throw new BadRequestException(EPinMessages.MESSAGE_ALREADY_PINNED)
      }

      // Kiểm tra giới hạn 5 tin nhắn ghim
      const count = await this.prismaService.pinnedMessage.count({
        where: { directChatId },
      })
      if (count >= 5) {
        throw new BadRequestException(EPinMessages.CANNOT_PIN_MORE_THAN_5_MESSAGES)
      }

      // Tạo pin mới
      const pinnedMessage = await this.prismaService.pinnedMessage.create({
        data: { messageId, directChatId, pinnedBy: userId },
        include: {
          Message: {
            include: {
              Author: { include: { Profile: true } },
            },
          },
        },
      })

      // Tạo message thông báo
      const [userProfile, originalMessage, directChat] = await Promise.all([
        this.prismaService.profile.findUnique({ where: { userId } }),
        this.prismaService.message.findUnique({
          where: { id: messageId },
          include: { Media: true },
        }),
        this.prismaService.directChat.findUnique({ where: { id: directChatId } }),
      ])

      const fullName = userProfile?.fullName || 'Người dùng'
      const decryptedOriginalMessage = originalMessage
        ? this.encryptMessageService.decryptMessage(originalMessage)
        : null
      const messageDesc = decryptedOriginalMessage
        ? this.getMessageDescription(decryptedOriginalMessage)
        : ''
      const recipientId =
        directChat?.creatorId === userId ? directChat.recipientId : directChat?.creatorId || userId

      const pinNoticeMessage = await this.messageService.createNewMessage(
        `${fullName} ${this.pinMessageDescText} ${messageDesc}`,
        userId,
        new Date(),
        EMessageTypes.PIN_NOTICE,
        recipientId,
        undefined,
        undefined,
        messageId,
        directChatId,
        undefined
      )

      this.syncDataToESService.syncDataToES({
        type: ESyncDataToESWorkerType.CREATE_MESSAGE,
        message: pinNoticeMessage,
      })

      //>>> websocket - Emit socket events
      this.userConnectionService.emitToDirectChat(
        directChatId,
        EMessagingEmitSocketEvents.send_message_direct,
        pinNoticeMessage
      )

      this.userConnectionService.emitToDirectChat(
        directChatId,
        EMessagingEmitSocketEvents.pin_message,
        { messageId, directChatId, isPinned: true, userId, pinnedMessage }
      )

      return pinnedMessage
    } else {
      // Bỏ ghim
      const deletedPin = await this.prismaService.pinnedMessage.deleteMany({
        where: { messageId, directChatId },
      })

      // Tạo message thông báo
      const [userProfile, originalMessage, directChat] = await Promise.all([
        this.prismaService.profile.findUnique({ where: { userId } }),
        this.prismaService.message.findUnique({
          where: { id: messageId },
          include: { Media: true },
        }),
        this.prismaService.directChat.findUnique({ where: { id: directChatId } }),
      ])

      const fullName = userProfile?.fullName || 'Người dùng'
      const decryptedOriginalMessage = originalMessage
        ? this.encryptMessageService.decryptMessage(originalMessage)
        : null
      const messageDesc = decryptedOriginalMessage
        ? this.getMessageDescription(decryptedOriginalMessage)
        : ''
      const recipientId =
        directChat?.creatorId === userId ? directChat.recipientId : directChat?.creatorId || userId

      const pinNoticeMessage = await this.messageService.createNewMessage(
        `${fullName} ${this.unpinMessageDescText} ${messageDesc}`,
        userId,
        new Date(),
        EMessageTypes.PIN_NOTICE,
        recipientId,
        undefined,
        undefined,
        undefined,
        directChatId,
        undefined
      )

      this.syncDataToESService.syncDataToES({
        type: ESyncDataToESWorkerType.CREATE_MESSAGE,
        message: pinNoticeMessage,
      })

      //>>> websocket - Emit socket events
      this.userConnectionService.emitToDirectChat(
        directChatId,
        EMessagingEmitSocketEvents.send_message_direct,
        pinNoticeMessage
      )

      this.userConnectionService.emitToDirectChat(
        directChatId,
        EMessagingEmitSocketEvents.pin_message,
        { messageId, directChatId, isPinned: false, userId }
      )

      return { success: true, deletedCount: deletedPin.count }
    }
  }

  /**
   * Lấy danh sách tin nhắn đã ghim trong direct chat (cho tất cả user trong cuộc trò chuyện)
   * @param directChatId ID của cuộc trò chuyện
   * @param groupChatId ID của nhóm
   */
  async getPinnedMessages(directChatId?: number, groupChatId?: number) {
    if (directChatId && groupChatId) {
      throw new BadRequestException(EPinMessages.INVALID_PARAMS)
    }
    if (!directChatId && !groupChatId) {
      throw new BadRequestException(EPinMessages.INVALID_PARAMS)
    }
    const pinnedMessages = await this.prismaService.pinnedMessage.findMany({
      where: {
        directChatId,
        groupChatId,
      },
      include: {
        Message: {
          include: {
            Author: {
              include: {
                Profile: true,
              },
            },
            ReplyTo: {
              include: {
                Author: {
                  include: {
                    Profile: true,
                  },
                },
              },
            },
            Media: true,
            Sticker: true,
          },
        },
      },
      orderBy: { pinnedAt: 'desc' },
      take: 5,
    })

    // Giải mã messages
    return pinnedMessages.map((pinnedMsg) => ({
      ...pinnedMsg,
      Message: this.encryptMessageService.decryptMessage(pinnedMsg.Message),
    }))
  }

  /**
   * Lấy số lượng tin nhắn đã ghim trong direct chat (tổng cộng cho tất cả user)
   * @param directChatId ID của cuộc trò chuyện
   * @param groupChatId ID của nhóm
   */
  async getPinnedCount(directChatId?: number, groupChatId?: number) {
    if (directChatId && groupChatId) {
      throw new BadRequestException(EPinMessages.INVALID_PARAMS)
    }
    if (!directChatId && !groupChatId) {
      throw new BadRequestException(EPinMessages.INVALID_PARAMS)
    }
    return this.prismaService.pinnedMessage.count({
      where: {
        directChatId,
        groupChatId,
      },
    })
  }

  /**
   * Kiểm tra xem tin nhắn có được ghim trong cuộc trò chuyện không
   * @param messageId ID của tin nhắn
   * @param directChatId ID của cuộc trò chuyện
   * @param groupChatId ID của nhóm
   */
  async isMessagePinned(messageId: number, directChatId?: number, groupChatId?: number) {
    if (directChatId && groupChatId) {
      throw new BadRequestException(EPinMessages.INVALID_PARAMS)
    }
    if (!directChatId && !groupChatId) {
      throw new BadRequestException(EPinMessages.INVALID_PARAMS)
    }
    const pinnedMessage = await this.prismaService.pinnedMessage.findFirst({
      where: {
        messageId,
        directChatId,
        groupChatId,
      },
    })
    return !!pinnedMessage
  }

  async pinOrUnpinMessageInGroupChat(
    messageId: number,
    groupChatId: number,
    userId: number,
    isPinned: boolean
  ) {
    // Kiểm tra quyền
    const member = await this.groupMemberService.findMemberInGroupChat(groupChatId, userId)
    if (!member) {
      throw new BadRequestException(EGroupMemberMessages.USER_NOT_IN_GROUP_CHAT)
    }
    if (member.role !== EGroupChatRoles.ADMIN) {
      const hasPermission = await this.groupChatService.checkGroupChatPermission(
        groupChatId,
        EGroupChatPermissions.PIN_MESSAGE
      )
      if (!hasPermission) {
        throw new BadRequestException(EGroupMemberMessages.USER_HAS_NO_PERMISSION_PIN_MESSAGE)
      }
    }

    if (isPinned) {
      // Kiểm tra tin nhắn đã được ghim chưa
      const existingPin = await this.prismaService.pinnedMessage.findFirst({
        where: { messageId, groupChatId },
      })
      if (existingPin) {
        throw new BadRequestException(EPinMessages.MESSAGE_ALREADY_PINNED)
      }

      // Kiểm tra giới hạn 5 tin nhắn ghim
      const count = await this.prismaService.pinnedMessage.count({
        where: { groupChatId },
      })
      if (count >= 5) {
        throw new BadRequestException(EPinMessages.CANNOT_PIN_MORE_THAN_5_MESSAGES)
      }

      // Tạo pin mới
      const pinnedMessage = await this.prismaService.pinnedMessage.create({
        data: { messageId, groupChatId, pinnedBy: userId },
        include: {
          Message: {
            include: {
              Author: { include: { Profile: true } },
            },
          },
        },
      })

      // Tạo message thông báo
      const [userProfile, originalMessage] = await Promise.all([
        this.prismaService.profile.findUnique({ where: { userId } }),
        this.prismaService.message.findUnique({
          where: { id: messageId },
          include: { Media: true },
        }),
      ])

      const fullName = userProfile?.fullName || 'Người dùng'
      const decryptedOriginalMessage = originalMessage
        ? this.encryptMessageService.decryptMessage(originalMessage)
        : null
      const messageDesc = decryptedOriginalMessage
        ? this.getMessageDescription(decryptedOriginalMessage)
        : ''

      const pinNoticeMessage = await this.messageService.createNewMessage(
        `${fullName} ${this.pinMessageDescText} ${messageDesc}`,
        userId,
        new Date(),
        EMessageTypes.PIN_NOTICE,
        undefined,
        undefined,
        undefined,
        messageId,
        undefined,
        groupChatId
      )

      this.syncDataToESService.syncDataToES({
        type: ESyncDataToESWorkerType.CREATE_MESSAGE,
        message: pinNoticeMessage,
      })

      //>>> websocket - Emit socket events
      this.userConnectionService.sendNewMessageToGroupChat(groupChatId, pinNoticeMessage)

      //>>> websocket (isPinned)
      // // PHÁT SOCKET EVENT ĐẾN TẤT CẢ CLIENT CÙNG PHÒNG
      // this.userConnectionService
      //   .getMessagingServer()
      //   .to(createGroupChatRoomName(groupChatId))
      //   .emit(EMessagingEmitSocketEvents.pin_message_group, {
      //     messageId,
      //     groupChatId,
      //     isPinned: true,
      //     userId,
      //     pinnedMessage,
      //   })

      return pinnedMessage
    } else {
      // Bỏ ghim
      const deletedPin = await this.prismaService.pinnedMessage.deleteMany({
        where: { messageId, groupChatId },
      })

      // Tạo message thông báo
      const [userProfile, originalMessage] = await Promise.all([
        this.prismaService.profile.findUnique({ where: { userId } }),
        this.prismaService.message.findUnique({
          where: { id: messageId },
          include: { Media: true },
        }),
      ])

      const fullName = userProfile?.fullName || 'Người dùng'
      const decryptedOriginalMessage = originalMessage
        ? this.encryptMessageService.decryptMessage(originalMessage)
        : null
      const messageDesc = decryptedOriginalMessage
        ? this.getMessageDescription(decryptedOriginalMessage)
        : ''

      const pinNoticeMessage = await this.messageService.createNewMessage(
        `${fullName} ${this.unpinMessageDescText} ${messageDesc}`,
        userId,
        new Date(),
        EMessageTypes.PIN_NOTICE,
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        groupChatId
      )

      this.syncDataToESService.syncDataToES({
        type: ESyncDataToESWorkerType.CREATE_MESSAGE,
        message: pinNoticeMessage,
      })

      //>>> websocket - Emit socket events
      this.userConnectionService.sendNewMessageToGroupChat(groupChatId, pinNoticeMessage)

      //>>> websocket (not isPinned / else)
      // // PHÁT SOCKET EVENT ĐẾN TẤT CẢ CLIENT CÙNG PHÒNG
      // this.userConnectionService
      //   .getMessagingServer()
      //   .to(createGroupChatRoomName(groupChatId))
      //   .emit(EMessagingEmitSocketEvents.pin_message_group, {
      //     messageId: pinNoticeMessage.id,
      //     groupChatId,
      //     isPinned: false,
      //     userId,
      //   })

      return { success: true, deletedCount: deletedPin.count }
    }
  }
}
