import type { EGroupChatPermissions } from '@/group-chat/group-chat.enum'
import type { GroupChatService as GroupChatServiceType } from 'protos/generated/conversation'
import { firstValueFrom } from 'rxjs'

export class GroupChatService {
  constructor(private instance: GroupChatServiceType) {}

  async checkGroupChatPermission(
    groupChatId: number,
    permission: EGroupChatPermissions
  ): Promise<boolean> {
    return (
      await firstValueFrom(
        this.instance.CheckGroupChatPermission({
          groupChatId,
          permission,
        })
      )
    ).allowed
  }
}
