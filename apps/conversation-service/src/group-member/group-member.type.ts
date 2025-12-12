import type { TGroupChatMemberWithUser } from '@/utils/entities/group-chat-member.entity'
import type {
  FindGroupChatMemberIdsRequest,
  FindGroupChatMemberIdsResponse,
  FindMemberInGroupChatRequest,
  FindMemberInGroupChatResponse,
} from 'protos/generated/conversation'

export type TAddMembersToGroupChatRes = {
  addedMembers: TGroupChatMemberWithUser[]
}

// gRPC Types
export type TFindMemberInGroupChatRequest = FindMemberInGroupChatRequest

export type TFindMemberInGroupChatResponse = FindMemberInGroupChatResponse

export type TFindGroupChatMemberIdsRequest = FindGroupChatMemberIdsRequest

export type TFindGroupChatMemberIdsResponse = FindGroupChatMemberIdsResponse
