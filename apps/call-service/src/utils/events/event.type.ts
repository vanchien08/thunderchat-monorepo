import type { IMessagingEmitSocketEvents, ICallEmitSocketEvents } from './socket.event'
import type { TPinnedMessageWithMessageWithAuthor } from '../entities/pinned-message.entity'
import type { Socket } from 'socket.io'

export type TPinMessageGroupEmitPayload = {
  messageId: number
  groupChatId: number
  isPinned: boolean
  userId: number
  pinnedMessage?: TPinnedMessageWithMessageWithAuthor
}

export type TClientSocket = Socket<{}, IMessagingEmitSocketEvents>

export type TCallClientSocket = Socket<{}, ICallEmitSocketEvents>
