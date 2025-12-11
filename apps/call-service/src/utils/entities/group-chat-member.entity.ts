import type { GroupChatMember } from '@prisma/client'
import type { TUser } from './user.entity'
import type { TProfile } from './profile.entity'
import { TGroupChat } from './group-chat.entity'

export type TGroupChatMember = GroupChatMember

export type TGroupChatMemberWithUser = TGroupChatMember & {
  User: TUser & {
    Profile: TProfile | null
  }
}

export type TGroupChatMemberWithUserAndGroupChat = TGroupChatMemberWithUser & {
  GroupChat: TGroupChat
}
