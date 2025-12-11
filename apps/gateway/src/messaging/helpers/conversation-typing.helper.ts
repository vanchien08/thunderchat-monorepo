import type { TConversationTypingFlags } from '../messaging.type'
import { EMessagingEmitSocketEvents } from '@/utils/events/socket.event'
import type { TUserId } from '@/user/user.type'
import type { TClientSocket } from '@/utils/events/event.type'

export class ConversationTypingManager {
  private readonly flags: TConversationTypingFlags = {}
  private readonly TYPING_TIME_OUT: number = 3000

  initTyping(senderId: TUserId, recipientSocket: TClientSocket, directChatId: number): void {
    if (this.flags[senderId]) {
      this.removeTyping(senderId)
    }
    this.flags[senderId] = setTimeout(() => {
      recipientSocket.emit(EMessagingEmitSocketEvents.typing_direct, false, directChatId)
    }, this.TYPING_TIME_OUT)
  }

  removeTyping(senderId: TUserId): void {
    clearTimeout(this.flags[senderId])
    delete this.flags[senderId]
  }
}
