import type { EMessageTypes } from '@/message/message.enum'
import type { SearchHit } from '@elastic/elasticsearch/lib/api/types'

export type TUserESMapping = {
  doc_id: number
  email: string
  full_name: string
}

export type TMessageESMapping = {
  doc_id: number
  content: string
  original_content: string
  message_type: EMessageTypes
  valid_user_ids: number[]
  is_deleted: boolean
  created_at: string
}

export type TESSearchGeneralResult<T> = SearchHit<T>
