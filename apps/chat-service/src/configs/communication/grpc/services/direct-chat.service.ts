import type { TDirectChat } from '@/utils/entities/direct-chat.entity'
import type { DirectChatService as DirectChatServiceType } from 'protos/generated/conversation'
import { firstValueFrom } from 'rxjs'

export class DirectChatService {
  constructor(private instance: DirectChatServiceType) {}

  async findConversationWithOtherUser(
    userId: number,
    otherUserId: number
  ): Promise<TDirectChat | null> {
    const directChatJson = (
      await firstValueFrom(
        this.instance.FindConversationWithOtherUser({
          userId,
          otherUserId,
        })
      )
    ).directChatJson
    return directChatJson ? (JSON.parse(directChatJson) as TDirectChat) : null
  }

  async createNewDirectChat(creatorId: number, recipientId: number): Promise<TDirectChat> {
    return JSON.parse(
      (
        await firstValueFrom(
          this.instance.CreateNewDirectChat({
            creatorId,
            recipientId,
          })
        )
      ).newDirectChatJson
    ) as TDirectChat
  }

  async updateLastSentMessage(directChatId: number, lastSentMessageId: number): Promise<void> {
    await firstValueFrom(
      this.instance.UpdateLastSentMessage({
        directChatId,
        lastSentMessageId,
      })
    )
  }

  async findById(directChatId: number): Promise<TDirectChat | null> {
    const directChatJson = (await firstValueFrom(this.instance.findById({ directChatId })))
      .directChatJson
    return directChatJson ? (JSON.parse(directChatJson) as TDirectChat) : null
  }
}
