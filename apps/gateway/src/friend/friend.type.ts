import type { TUserWithProfile } from '@/utils/entities/user.entity'

export type TGetFriendsData = {
  id: number
  senderId: number
  createdAt: Date
  Recipient: TUserWithProfile
  Sender: TUserWithProfile // Thêm trường Sender
}
