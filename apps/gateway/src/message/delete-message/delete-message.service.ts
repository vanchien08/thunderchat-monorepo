import { Injectable, Inject } from '@nestjs/common'
import { PrismaService } from '@/configs/db/prisma.service'
import { UserConnectionService } from '@/connection/user-connection.service'
import { EMessagingEmitSocketEvents } from '@/utils/events/socket.event'
import { EProviderTokens, ESyncDataToESWorkerType } from '@/utils/enums'
import type { TDeleteMessageResult } from './delete-message.type'
import { EMessageTypes } from '@/message/message.enum'
import { UploadService } from '@/upload/upload.service'
import { Prisma } from '@prisma/client'
import type { TMessageFullInfo, TMessageWithMedia } from '@/utils/entities/message.entity'
import { SyncDataToESService } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.service'

@Injectable()
export class DeleteMessageService {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prisma: PrismaService,
    private userConnectionService: UserConnectionService,
    private uploadService: UploadService,
    private syncDataToESService: SyncDataToESService
  ) {}

  async recallMessage(msgId: number, userId: number): Promise<TDeleteMessageResult> {
    // Validate tin nhắn và quyền
    const validationResult = await this.validateMessageAndPermission(msgId, userId)
    if (!validationResult.success) {
      return validationResult
    }

    const msg = validationResult.data!

    // Sử dụng transaction để đảm bảo tính toàn vẹn dữ liệu
    const result = await this.prisma
      .$transaction(async (tx) => {
        // // Xóa file S3 nếu là media message
        // await this.deleteS3Files(msg)

        // Chuẩn bị data update
        const updateData = this.prepareUpdateData(msg)

        // Cập nhật message
        const updated = await tx.message.update({
          where: { id: msgId },
          data: updateData,
          include: {
            Author: {
              include: {
                Profile: true,
              },
            },
            Media: true,
            Sticker: true,
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
          },
        })

        // // Xóa record trong message_media nếu là media message
        // await this.deleteMessageMediaRecord(tx, msg)

        // Tìm và emit tin nhắn reply
        await this.handleReplyMessages(tx, msgId, updated)

        return {
          success: true,
          message: 'Message recalled successfully',
          data: updated,
          errorCode: null,
          errors: null,
        }
      })
      .catch((error) => {
        // Xử lý lỗi transaction
        return {
          success: false,
          message: error.message || 'Recall message failed',
          data: null,
          errorCode: 'TRANSACTION_ERROR',
          errors: error,
        }
      })

    this.syncDataToESService.syncDataToES({
      type: ESyncDataToESWorkerType.DELETE_MESSAGE,
      data: msg,
    })

    return result
  }

  /**
   * Validate tin nhắn tồn tại và user có quyền xóa
   */
  private async validateMessageAndPermission(
    msgId: number,
    userId: number
  ): Promise<TDeleteMessageResult> {
    const msg = await this.prisma.message.findUnique({
      where: { id: msgId },
      include: { Media: true },
    })

    if (!msg) {
      return {
        success: false,
        message: 'Message not found',
        data: null,
        errorCode: 'NOT_FOUND',
        errors: null,
      }
    }

    if (msg.authorId !== userId) {
      return {
        success: false,
        message: 'You do not have permission to delete this message',
        data: null,
        errorCode: 'FORBIDDEN',
        errors: null,
      }
    }

    return {
      success: true,
      message: 'Validation successful',
      data: msg,
      errorCode: null,
      errors: null,
    }
  }

  /**
   * Xóa file S3 nếu là media message
   */
  private async deleteS3Files(msg: TMessageWithMedia): Promise<void> {
    if (msg.type === EMessageTypes.MEDIA && msg.Media) {
      try {
        // Xóa file chính trên S3
        await this.uploadService.deleteFileByUrl(msg.Media.url)

        // Xóa thumbnail nếu có
        if (msg.Media.thumbnailUrl) {
          await this.uploadService.deleteFileByUrl(msg.Media.thumbnailUrl)
        }
      } catch (err) {
        throw new Error(`Failed to delete file on S3: ${err.message}`)
      }
    }
  }

  /**
   * Chuẩn bị data update cho message
   */
  private prepareUpdateData(msg: TMessageWithMedia): Prisma.MessageUpdateInput {
    let updateData: Prisma.MessageUpdateInput = {
      isDeleted: true,
      content: '',
      ReplyTo: { disconnect: true },
    }

    // // Nếu là MEDIA thì set mediaId thành null
    if (msg.type === EMessageTypes.MEDIA) {
      updateData = {
        ...updateData,
        Media: { disconnect: true },
      }
    }
    // Nếu là STICKER thì set stickerId thành null
    if (msg.type === EMessageTypes.STICKER) {
      updateData = {
        ...updateData,
        Sticker: { disconnect: true },
      }
    }
    // Nếu là PIN_NOTICE thì chỉ set content thành rỗng (system message)
    else if (msg.type === EMessageTypes.PIN_NOTICE) {
      updateData = {
        ...updateData,
        content: '',
      }
    }

    return updateData
  }

  // /**
  //  * Xóa record trong message_media nếu là media message
  //  */
  // private async deleteMessageMediaRecord(tx: any, msg: any): Promise<void> {
  //   if (msg.type === EMessageTypes.MEDIA && msg.mediaId) {
  //     await tx.messageMedia.delete({
  //       where: { id: msg.mediaId },
  //     })
  //   }
  // }

  /**
   * Tìm và emit tin nhắn reply để cập nhật reply preview
   */
  private async handleReplyMessages(
    tx: any,
    msgId: number,
    updated: TMessageFullInfo
  ): Promise<void> {
    // Tìm tất cả tin nhắn reply đến tin nhắn này
    const replyMessages = await tx.message.findMany({
      where: { replyToId: msgId },
      include: {
        Media: true,
        Sticker: true,
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
      },
    })

    const directChatId = updated.directChatId
    if (directChatId) {
      // Lấy thông tin direct chat để emit cho cả 2 user
      const directChat = await this.prisma.directChat.findUnique({
        where: { id: directChatId },
      })
      if (directChat) {
        // Emit tin nhắn đã thu hồi
        const creatorSockets = this.userConnectionService.getConnectedClient(directChat.creatorId)
        const recipientSockets = this.userConnectionService.getConnectedClient(
          directChat.recipientId
        )

        if (creatorSockets && recipientSockets) {
          for (const creatorSocket of creatorSockets) {
            creatorSocket?.emit(EMessagingEmitSocketEvents.send_message_direct, updated)
          }
          for (const recipientSocket of recipientSockets) {
            recipientSocket?.emit(EMessagingEmitSocketEvents.send_message_direct, updated)
          }
          // Emit tất cả tin nhắn reply để cập nhật reply preview
          for (const replyMsg of replyMessages) {
            for (const creatorSocket of creatorSockets) {
              creatorSocket?.emit(EMessagingEmitSocketEvents.send_message_direct, replyMsg)
            }
            for (const recipientSocket of recipientSockets) {
              recipientSocket?.emit(EMessagingEmitSocketEvents.send_message_direct, replyMsg)
            }
          }
        } else {
        }
      }
    } else {
      const groupChatId = updated.groupChatId
      if (groupChatId) {
        const groupChat = await this.prisma.groupChat.findUnique({
          where: { id: groupChatId },
        })
        if (groupChat) {
          this.userConnectionService.sendNewMessageToGroupChat(groupChatId, updated)
          for (const replyMsg of replyMessages) {
            this.userConnectionService.sendNewMessageToGroupChat(groupChatId, replyMsg)
          }
        }
      }
    }
  }
}
