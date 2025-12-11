import type { PinnedMessage } from '@prisma/client'
import type { TMessageWithAuthor } from './message.entity'

export type TPinnedMessage = PinnedMessage

export type TPinnedMessageWithMessageWithAuthor = TPinnedMessage & {
  Message: TMessageWithAuthor
}
