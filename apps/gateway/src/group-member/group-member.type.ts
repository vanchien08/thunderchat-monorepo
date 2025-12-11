import type { TGroupChatMemberWithUser } from '@/utils/entities/group-chat-member.entity'

export type TAddMembersToGroupChatRes = {
  addedMembers: TGroupChatMemberWithUser[]
}
