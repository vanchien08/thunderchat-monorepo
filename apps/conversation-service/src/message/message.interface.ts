import type { FetchMsgsParamsDTO } from './message.dto'
import type { TGetDirectMessagesData } from './message.type'
import type {
  TGetNewerDirectMessagesRequest,
  TGetNewerDirectMessagesResponse,
  TCreateNewMessageRequest,
  TCreateNewMessageResponse,
  TUpdateMessageStatusRequest,
  TUpdateMessageStatusResponse,
  TFindMessagesForGlobalSearchRequest,
  TFindMessagesForGlobalSearchResponse,
} from './message.type'

export interface IMessageController {
  fetchMessages: (directChatId: FetchMsgsParamsDTO) => Promise<TGetDirectMessagesData>
}

export interface IMessageGrpcController {
  getNewerDirectMessages(
    request: TGetNewerDirectMessagesRequest
  ): Promise<TGetNewerDirectMessagesResponse>
  createNewMessage(request: TCreateNewMessageRequest): Promise<TCreateNewMessageResponse>
  updateMessageStatus(request: TUpdateMessageStatusRequest): Promise<TUpdateMessageStatusResponse>
  findMessagesForGlobalSearch(
    request: TFindMessagesForGlobalSearchRequest
  ): Promise<TFindMessagesForGlobalSearchResponse>
}
