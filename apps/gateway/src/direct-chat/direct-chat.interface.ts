import { TUser } from '@/utils/entities/user.entity'
import type {
  FetchDirectChatDTO,
  FetchDirectChatsDTO,
  FindConversationWithOtherUserDTO,
  DeleteDirectChatDTO,
} from './direct-chat.dto'
import type { TFetchDirectChatsData, TFindDirectChatData } from './direct-chat.type'
import type { TDirectChat } from '@/utils/entities/direct-chat.entity'
import type { TSuccess } from '@/utils/types'

export interface IDirectChatsController {
  fetchDirectChat: (params: FetchDirectChatDTO, user: TUser) => Promise<TFindDirectChatData | null>
  fetchAllDirectChats: (query: FetchDirectChatsDTO, user: TUser) => Promise<TFetchDirectChatsData[]>
  findConversationWithOtherUser: (
    params: FindConversationWithOtherUserDTO,
    user: TUser
  ) => Promise<TDirectChat | null>
  deleteDirectChat: (query: DeleteDirectChatDTO, user: TUser) => Promise<TSuccess>
}
