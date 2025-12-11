import type { FetchMsgsParamsDTO } from './message.dto'
import type { TGetDirectMessagesData } from './message.type'

export interface IMessageController {
  fetchMessages: (directChatId: FetchMsgsParamsDTO) => Promise<TGetDirectMessagesData>
}
