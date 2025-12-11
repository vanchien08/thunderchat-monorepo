import type { CallSession } from '@prisma/client'
import type { TUserWithProfile } from './user.entity'

export type TCallSession = CallSession

export type TVoiceCallSessionWithUsers = CallSession & {
  caller: TUserWithProfile
  callee: TUserWithProfile
}

export type TCallSessionId = TCallSession['id']
