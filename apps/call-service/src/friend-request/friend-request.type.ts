import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { $Enums } from '@prisma/client'
import type { EFriendRequestStatus } from './friend-request.enum'

export type TGetFriendRequestsData = {
   id: number
   Sender: TUserWithProfile
   Recipient: TUserWithProfile
   createdAt: Date
   status: $Enums.FriendRequestsStatus
   senderId: number
   recipientId: number
   updatedAt: Date
}

export type TFriendRequestPayload = {
   requestId: number
   action: EFriendRequestStatus
}
