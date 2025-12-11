import type { TUser } from '@/utils/entities/user.entity'
import type { TogglePinConversationPayloadDTO } from './pin-conversation.dto'
import type { TTogglePinConversationRes } from './pin-conversation.type'
import type { TPinnedChat } from '@/utils/entities/pinned-chat.entity'

export interface IPinConversation {
  togglePinConversation(
    user: TUser,
    query: TogglePinConversationPayloadDTO
  ): Promise<TTogglePinConversationRes>
  getPinnedChatsByUser(user: TUser): Promise<TPinnedChat[]>
}
