import { EMessagingEmitSocketEvents } from '@/utils/events/socket.event'
import type { UserConnectionService as UserConnectionServiceType } from 'protos/generated/chat'
import type { TMessageFullInfo } from '@/utils/entities/message.entity'
import type { TGroupChat } from '@/utils/entities/group-chat.entity'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import { firstValueFrom } from 'rxjs'

export class UserConnectionService {
  constructor(private instance: UserConnectionServiceType) {}

  async getConnectedClientsCountForAdmin(): Promise<number> {
    return (await firstValueFrom(this.instance.GetConnectedClientsCountForAdmin({}))).count
  }

  async emitToDirectChat(
    directChatId: number,
    event: EMessagingEmitSocketEvents,
    payload: any
  ): Promise<void> {
    await firstValueFrom(
      this.instance.EmitToDirectChat({
        directChatId,
        event,
        payloadJson: JSON.stringify(payload),
      })
    )
  }

  async sendNewMessageToGroupChat(
    groupChatId: TGroupChat['id'],
    newMessage: TMessageFullInfo
  ): Promise<void> {
    await firstValueFrom(
      this.instance.SendNewMessageToGroupChat({
        groupChatId,
        newMessageJson: JSON.stringify(newMessage),
      })
    )
  }

  async updateGroupChatInfo(
    groupChatId: number,
    groupName?: string,
    groupAvatarUrl?: string
  ): Promise<void> {
    await firstValueFrom(
      this.instance.UpdateGroupChatInfo({
        groupChatId,
        groupName: groupName || '',
        groupAvatarUrl: groupAvatarUrl || '',
      })
    )
  }

  async createGroupChat(
    groupChat: TGroupChat,
    memberIds: number[],
    creator: TUserWithProfile
  ): Promise<void> {
    await firstValueFrom(
      this.instance.CreateGroupChat({
        groupChatJson: JSON.stringify(groupChat),
        memberIds,
        creatorJson: JSON.stringify(creator),
      })
    )
  }

  async addMembersToGroupChat(
    groupChat: TGroupChat,
    memberIds: number[],
    executor: TUserWithProfile
  ): Promise<void> {
    await firstValueFrom(
      this.instance.AddMembersToGroupChat({
        groupChatJson: JSON.stringify(groupChat),
        memberIds,
        executorJson: JSON.stringify(executor),
      })
    )
  }

  async removeGroupChatMembers(groupChat: TGroupChat, memberIds: number[]): Promise<void> {
    await firstValueFrom(
      this.instance.RemoveGroupChatMembers({
        groupChatJson: JSON.stringify(groupChat),
        memberIds,
      })
    )
  }

  async deleteGroupChat(groupChatId: number): Promise<void> {
    await firstValueFrom(
      this.instance.DeleteGroupChat({
        groupChatId,
      })
    )
  }

  async memberLeaveGroupChat(groupChatId: number, userId: number): Promise<void> {
    await firstValueFrom(
      this.instance.MemberLeaveGroupChat({
        groupChatId,
        userId,
      })
    )
  }
}
