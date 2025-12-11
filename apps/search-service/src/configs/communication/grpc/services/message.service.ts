import type { TMessageForGlobalSearch } from '@/utils/entities/message.entity'
import { TCastedFields } from '@/utils/types'
import type { MessageService as MessageServiceType } from 'protos/generated/conversation'
import { firstValueFrom } from 'rxjs'

type TCastedMessageForGlobalSearch = TCastedFields<
  TMessageForGlobalSearch,
  {
    createdAt: string
    Media: TCastedFields<TMessageForGlobalSearch['Media'], { createdAt: string }> | null
    Author: TCastedFields<TMessageForGlobalSearch['Author'], { createdAt: string }> | null
    GroupChat: TCastedFields<TMessageForGlobalSearch['GroupChat'], { createdAt: string }> | null
  }
>

export class MessageService {
  constructor(private instance: MessageServiceType) {}

  async findMessagesForGlobalSearch(
    ids: number[],
    limit: number
  ): Promise<TCastedMessageForGlobalSearch[]> {
    const messagesJson = (
      await firstValueFrom(
        this.instance.FindMessagesForGlobalSearch({
          ids,
          limit,
        })
      )
    ).messagesJson
    return messagesJson.map(
      (messageJson) => JSON.parse(messageJson) as TCastedMessageForGlobalSearch
    )
  }
}
