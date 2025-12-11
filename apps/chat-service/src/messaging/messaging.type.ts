import type { TUserId } from '@/user/user.type'
import type { TDirectChat } from '@/utils/entities/direct-chat.entity'
import type { TSuccess } from '@/utils/types'
import type { TMessageFullInfo } from '@/utils/entities/message.entity'
import type { EMessageTypes } from '@/message/message.enum'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { TGroupChat } from '@/utils/entities/group-chat.entity'
import type { EUserOnlineStatus } from '@/utils/enums'
import type { TGroupChatMemberWithUserAndGroupChat } from '@/utils/entities/group-chat-member.entity'
import type { TClientSocket } from '@/utils/events/event.type'

export type TClientAuth = {
  clientId: number
}

export type TMsgToken = string

export type TConversationTypingFlags = {
  [key: TUserId]: NodeJS.Timeout
}

export type TUserKey = {
  encryptMsgKey: string
}

export type TSendDirectMessageRes = TSuccess & {
  newMessage: TMessageFullInfo
}

export type TFindDirectChatWithOtherUser = {
  directChat: TDirectChat
  isNew: boolean
}

export type THandleMessageParamsMessage = {
  content: string
  timestamp: Date
  directChatId?: number
  receiverId?: number
  groupId?: number
  type: EMessageTypes
  stickerId?: number
  mediaId?: number
  replyToId?: number
}

export type THandleMessageParamsClient = {
  socket: TClientSocket
  id: number
}

export type THandleEmitNewMessageParams = {
  client: THandleMessageParamsClient
  receiverId?: number
  newMessage: TMessageFullInfo
  isNewDirectChat?: boolean
  directChat?: TDirectChat
  groupChat?: TGroupChat
  sender: TUserWithProfile
}

export type THandleCheckUserOnlineRes = TSuccess & {
  onlineStatus: EUserOnlineStatus
}

export type TCheckCanSendMessageInGroupChat = {
  member: TGroupChatMemberWithUserAndGroupChat
}
