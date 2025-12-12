import type { TDirectChat } from '@/utils/entities/direct-chat.entity'
import type { EVoiceCallStatus } from './voice-call.enum'
import type { TUserId } from '@/user/user.type'

export type TVoiceCallRequestRes = {
  status: EVoiceCallStatus
  session?: TActiveVoiceCallSession
}

export type TCallSessionActiveId = string

export type TActiveVoiceCallSession = {
  id: TCallSessionActiveId
  status: EVoiceCallStatus
  callerUserId: TUserId
  calleeUserId: TUserId
  directChatId: TDirectChat['id']
}
