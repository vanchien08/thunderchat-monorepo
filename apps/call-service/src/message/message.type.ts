import type { TMessage, TMessageFullInfo } from '@/utils/entities/message.entity'
import type { EMessageStatus } from '@/utils/enums'
import type { EMessageTypes } from '@/message/message.enum'

export type TNewGroupMessage = {
  id: number
  content: string
  authorId: number
  directChatId: number
  createdAt: Date
}

export type TGetDirectMessagesData = {
  hasMoreMessages: boolean
  directMessages: TGetDirectMessagesMessage[]
}

export type TMsgStatusPayload = {
  messageId: number
  status: EMessageStatus
}

export type TMessageOffset = TMessage['id']

export type TMessageUpdates = Partial<Omit<TMessage, 'id' | 'createdAt' | 'updatedAt' | 'content'>>

export type TSendMessageDto = {
  content?: string
  type: EMessageTypes
  mediaUrl?: string
}

export type TGetDirectMessagesMessage = TMessageFullInfo
