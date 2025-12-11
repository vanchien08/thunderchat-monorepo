import type { EChatType } from '@/utils/enums'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { SortResults } from '@elastic/elasticsearch/lib/api/types'

export type TGlobalSearchData = {
  users: (TUserWithProfile & {
    isOnline: boolean
  })[]
  messages: {
    id: number
    avatarUrl?: string
    conversationName: string
    messageContent: string
    mediaContent?: string
    highlights: string[]
    chatType: EChatType
    chatId: number
    createdAt: string
  }[]
  nextSearchOffset: {
    messageSearchOffset?: TMessageSearchOffset
    userSearchOffset?: TUserSearchOffset
  }
}

export type TMessageSearchOffset = SortResults

export type TUserSearchOffset = SortResults

export type TConversationSearchResult = {
  id: number
  type: EChatType
  title: string
  email?: string
  avatar?: {
    src: string
  }
  subtitle?: {
    content: string
  }
}
