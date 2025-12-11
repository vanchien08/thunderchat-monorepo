import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { TSuccess } from '@/utils/types'
import type {
  JoinGroupChatDTO,
  MarkAsSeenDTO,
  SendDirectMessageDTO,
  TypingDTO,
  CheckUserOnlineDTO,
  JoinDirectChatDTO,
} from './messaging.dto'
import type { THandleCheckUserOnlineRes, TSendDirectMessageRes } from './messaging.type'
import type { TClientSocket } from '@/utils/events/event.type'
import type { TGroupChat } from '@/utils/entities/group-chat.entity'
import type { UpdateProfileDto } from '@/profile/profile.dto'

export interface IMessagingGateway {
  handleSendDirectMessage: (
    payload: SendDirectMessageDTO,
    client: TClientSocket
  ) => Promise<TSendDirectMessageRes>
  handleMarkAsSeenInDirectChat: (data: MarkAsSeenDTO, client: TClientSocket) => Promise<void>
  handleTyping: (data: TypingDTO, client: TClientSocket) => Promise<void>
  handleJoinGroupChat: (data: JoinGroupChatDTO, client: TClientSocket) => Promise<TSuccess>
  handleCheckUserOnlineStatus: (data: CheckUserOnlineDTO) => Promise<THandleCheckUserOnlineRes>
  handleJoinDirectChat: (data: JoinDirectChatDTO, client: TClientSocket) => Promise<TSuccess>
  broadcastAddMembersToGroupChat: (
    groupChat: TGroupChat,
    groupMemberIds: number[],
    executor: TUserWithProfile
  ) => Promise<void>
  broadcastCreateGroupChat: (
    groupChat: TGroupChat,
    groupMemberIds: number[],
    creator: TUserWithProfile
  ) => Promise<void>
  broadcastRemoveGroupChatMembers: (
    groupChat: TGroupChat,
    removedMemberIds: number[]
  ) => Promise<void>
  broadcastMemberLeaveGroupChat: (groupChatId: number, userId: number) => Promise<void>
  broadcastUpdateGroupChat: (groupChatId: number, groupChat: Partial<TGroupChat>) => Promise<void>
  broadcastUpdateUserInfo: (userId: number, updates: UpdateProfileDto) => Promise<void>
  broadcastDeleteDirectChat: (directChatId: number, deleter: TUserWithProfile) => Promise<void>
  broadcastDeleteGroupChat: (groupChatId: number) => Promise<void>
}
