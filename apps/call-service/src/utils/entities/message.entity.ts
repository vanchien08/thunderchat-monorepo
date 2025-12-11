import type { Message } from '@prisma/client'
import type { TUserWithProfile } from './user.entity'
import type { TMessageMedia } from './message-media.entity'
import type { TGroupChatWithMembers } from './group-chat.entity'
import type { TSticker } from './sticker.entity'

export type TMessage = Message

export type TMessageWithAuthor = TMessage & {
  Author: TUserWithProfile
}

export type TMessageWithRecipient = TMessage & {
  Recipient: TUserWithProfile | null
}

export type TMessageForGlobalSearch = TMessageWithMedia & {
  Author: TUserWithProfile | null
  GroupChat: TGroupChatWithMembers | null
}

export type TMessageReplyTo = TMessageWithAuthor & {
  ReplyTo: TMessageWithAuthor | null
}

export type TMsgWithMediaSticker = TMessage & {
  Media: TMessageMedia | null
  Sticker: TSticker | null
}

export type TMessageFullInfo = TMessageWithAuthor & {
  ReplyTo:
    | (TMsgWithMediaSticker & {
        Author: TUserWithProfile
      })
    | null
  Media: TMessageMedia | null
  Sticker: TSticker | null
}

export type TMessageWithMedia = TMessage & {
  Media: TMessageMedia | null
}
