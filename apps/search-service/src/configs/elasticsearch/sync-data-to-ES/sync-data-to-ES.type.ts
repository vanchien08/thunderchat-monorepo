import type { TMessage, TMessageWithMedia } from '@/utils/entities/message.entity'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { TCastedFields } from '@/utils/types'

export type TCastedMessageWithMedia = TCastedFields<
  TMessageWithMedia,
  {
    Media: TCastedFields<
      TMessageWithMedia['Media'],
      {
        createdAt: string
      }
    >
    createdAt: string
  }
>

export type TCastedUserWithProfile = TCastedFields<
  TUserWithProfile,
  {
    createdAt: string
    Profile: TCastedFields<TUserWithProfile['Profile'], { createdAt: string }>
  }
>

export type TCastedMessage = TCastedFields<TMessage, { createdAt: string }>
