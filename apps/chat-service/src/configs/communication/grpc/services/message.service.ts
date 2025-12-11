import { EMessageStatus, EMessageTypes } from '@/message/message.enum'
import type { TMessageOffset } from '@/message/message.type'
import type { TMessageFullInfo } from '@/utils/entities/message.entity'
import type { TMessage } from '@/utils/entities/message.entity copy'
import { convertDateToGrpcTimestamp } from '@/utils/helpers'
import type { MessageService as MessageServiceType } from 'protos/generated/conversation'
import { firstValueFrom } from 'rxjs'

export class MessageService {
  constructor(private instance: MessageServiceType) {}

  async getNewerDirectMessages(
    messageOffset: TMessageOffset,
    directChatId: number | undefined,
    groupChatId: number | undefined,
    limit: number
  ): Promise<TMessageFullInfo[]> {
    const messagesJson = (
      await firstValueFrom(
        this.instance.GetNewerDirectMessages({
          messageOffset,
          directChatId,
          groupChatId,
          limit,
        })
      )
    ).messagesJson
    return messagesJson.map((msg) => JSON.parse(msg) as TMessageFullInfo)
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
  ): Promise<TMessageFullInfo> {
    return JSON.parse(
      (
        await firstValueFrom(
          this.instance.CreateNewMessage({
            encryptedContent,
            authorId,
            timestamp: convertDateToGrpcTimestamp(timestamp),
            type,
            recipientId,
            stickerId,
            mediaId,
            replyToId,
            directChatId,
            groupChatId,
          })
        )
      ).newMessageJson
    ) as TMessageFullInfo
  }

  async updateMessageStatus(msgId: number, status: EMessageStatus): Promise<TMessage> {
    return JSON.parse(
      (
        await firstValueFrom(
          this.instance.UpdateMessageStatus({
            msgId,
            status,
          })
        )
      ).messageJson
    ) as TMessage
  }
}
