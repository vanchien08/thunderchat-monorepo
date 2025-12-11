import type { GroupChat, GroupJoinRequest } from '@prisma/client'
import type { TGroupChatMemberWithUser } from './group-chat-member.entity'
import type { TUserWithProfile } from './user.entity'

export type TGroupChat = GroupChat

export type TGroupChatWithMembers = TGroupChat & {
  Members: TGroupChatMemberWithUser[]
}

export type TGroupJoinRequest = GroupJoinRequest

export type TGroupJoinRequestWithUser = TGroupJoinRequest & {
  Requester: TUserWithProfile
}

export type TGroupChatWithCreator = TGroupChat & {
  Creator: TUserWithProfile
}
