import type { TMessageWithMedia } from '@/utils/entities/message.entity'

export type TDeleteMessageResult = {
  success: boolean
  message: string
  data: TMessageWithMedia | null
  errorCode: string | null
  errors: unknown
}
