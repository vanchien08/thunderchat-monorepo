import type { TGroupChat } from '@/utils/entities/group-chat.entity'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { TMessage } from '@/utils/entities/message.entity'
import type { TGroupChatMemberWithUser } from '@/utils/entities/group-chat-member.entity'
import { EGroupChatPermissions } from './group-chat.enum'

export type TFetchGroupChatData = TGroupChat & {
  Members: TGroupChatMemberWithUser[]
}

export type TUploadGroupChatAvatar = {
  avatarUrl: string
}

export type TFetchGroupChatsData = TGroupChat & {
  LastSentMessage: TMessage | null
  Creator: TUserWithProfile
}

export type TGenerateInviteCode = {
  token: string
}

export type TCreateNewInviteCode = {
  inviteCode: string
}

export type TJoinGroupChatByInviteCode = {
  groupChatId: number
  message?: string
}

export type TFetchGroupChatPermissionsRes = {
  permissions: {
    [key in EGroupChatPermissions]: boolean
  }
}
