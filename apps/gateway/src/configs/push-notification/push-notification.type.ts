import type { TMessageWithAuthor } from '@/utils/entities/message.entity'
import type { TPushSubscriptionEndpoint } from '@/utils/entities/push-notification-subscription.entity'
import type { EChatType } from '@/utils/enums'
import type { Urgency } from 'web-push'

export type TWebPushUrgency = Urgency

export type TWebPushAction = {
  action: string
  title: string
  icon?: string
}

export type TPushNotificationType = 'new_message' | 'new_conversation'

export type TPushNotificationData = {
  actions?: TWebPushAction[]
  urgency?: TWebPushUrgency
  type: TPushNotificationType
  conversation: {
    title: string
    avatar?: string
    type: EChatType
    message: TMessageWithAuthor
  }
  topic?: string
  ttlInSeconds?: number
}

export type TWebPushSendNotificationResult = {
  success: TPushSubscriptionEndpoint[]
  failure: TPushSubscriptionEndpoint[]
}

export type TGetPublicVapidKeyResult = {
  publicKey: string
}
