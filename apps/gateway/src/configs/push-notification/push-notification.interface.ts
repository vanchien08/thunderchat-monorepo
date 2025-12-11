import type { TSuccess } from '@/utils/types'
import type {
  AddPushSubscriptionDTO,
  GetSubscriptionDTO,
  RemovePushSubscriptionDTO,
} from './push-notification.dto'
import type { TUser } from '@/utils/entities/user.entity'
import type { TGetPublicVapidKeyResult } from './push-notification.type'
import type { TPushNotificationSubscription } from '@/utils/entities/push-notification-subscription.entity'

export interface IPushNotificationSubscription {
  subscribeForUser(
    subscription: AddPushSubscriptionDTO,
    user: TUser
  ): Promise<TPushNotificationSubscription | null>
  unsubscribe(subscription: RemovePushSubscriptionDTO, user: TUser): Promise<TSuccess>
  getPublicVapidKey(): Promise<TGetPublicVapidKeyResult>
  getSubscription(query: GetSubscriptionDTO): Promise<TPushNotificationSubscription | null>
}
