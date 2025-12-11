import type { TGroupChatMemberWithUserAndGroupChat } from '@/utils/entities/group-chat-member.entity'
import type { GroupMemberService as GroupMemberServiceType } from 'protos/generated/conversation'
import { firstValueFrom } from 'rxjs'

export class GroupMemberService {
  constructor(private instance: GroupMemberServiceType) {}

  async findMemberInGroupChat(
    groupChatId: number,
    userId: number
  ): Promise<TGroupChatMemberWithUserAndGroupChat | null> {
    const groupChatMemberJson = (
      await firstValueFrom(this.instance.FindMemberInGroupChat({ groupChatId, userId }))
    ).groupChatMemberJson
    if (!groupChatMemberJson) return null
    return JSON.parse(groupChatMemberJson) as TGroupChatMemberWithUserAndGroupChat | null
  }

  async findGroupChatMemberIds(groupChatId: number): Promise<number[]> {
    return (await firstValueFrom(this.instance.FindGroupChatMemberIds({ groupChatId }))).memberIds
  }
}
