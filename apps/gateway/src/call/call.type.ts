import type { TDirectChat } from '@/utils/entities/direct-chat.entity'
import type { ECallStatus } from './call.enum'
import type { TUserId } from '@/user/user.type'

export type TCallRequestRes = {
  status: ECallStatus
  session?: TActiveCallSession
}

export type TCallSessionActiveId = string

export type TActiveCallSession = {
  id: TCallSessionActiveId
  status: ECallStatus
  callerUserId: TUserId
  calleeUserId: TUserId
  directChatId: TDirectChat['id']
  isVideoCall?: boolean
}
