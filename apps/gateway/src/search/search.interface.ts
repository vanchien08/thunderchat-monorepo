import type { TUser } from '@/utils/entities/user.entity'
import type { GlobalSearchPayloadDTO, SearchConversationsPayloadDTO } from './search.dto'
import type { TGlobalSearchData, TConversationSearchResult } from './search.type'

export interface ISearchController {
  searchGlobally(searchPayload: GlobalSearchPayloadDTO, user: TUser): Promise<TGlobalSearchData>
  searchConversations(
    searchPayload: SearchConversationsPayloadDTO,
    user: TUser
  ): Promise<TConversationSearchResult[]>
}
