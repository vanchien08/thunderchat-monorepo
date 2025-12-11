import type { UserConnectionService as UserConnectionServiceType } from 'protos/generated/chat'
import { firstValueFrom } from 'rxjs'
import type { UpdateProfileDto } from '@/profile/profile.dto'
import type { TUserId } from '@/user/user.type'
import type { TSocketId } from '@/connection/user-connection.type'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { TGetFriendRequestsData } from '@/friend-request/friend-request.type'

export class UserConnectionService {
  constructor(private instance: UserConnectionServiceType) {}

  async updateUserInfo(userId: number, updates: UpdateProfileDto): Promise<void> {
    await firstValueFrom(
      this.instance.UpdateUserInfo({
        userId,
        updatesJson: JSON.stringify(updates),
      })
    )
  }

  async removeConnectedClient(userId: TUserId, socketId?: TSocketId): Promise<void> {
    await firstValueFrom(this.instance.RemoveConnectedClient({ userId, socketId }))
  }

  async sendFriendRequest(
    sender: TUserWithProfile,
    recipientId: number,
    requestData: TGetFriendRequestsData
  ): Promise<void> {
    await firstValueFrom(
      this.instance.SendFriendRequest({
        senderJson: JSON.stringify(sender),
        recipientId,
        requestDataJson: JSON.stringify(requestData),
      })
    )
  }

  async friendRequestAction(senderId: number, requestId: number, action: string): Promise<void> {
    await firstValueFrom(
      this.instance.FriendRequestAction({
        senderId,
        requestId,
        action,
      })
    )
  }
}
