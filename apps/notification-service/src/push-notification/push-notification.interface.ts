import type { TSuccess } from '@/utils/types'
import type {
  AddPushSubscriptionDTO,
  GetSubscriptionDTO,
  RemovePushSubscriptionDTO,
} from './push-notification.dto'
import type { TUser } from '@/utils/entities/user.entity'
import type {
  TGetPublicVapidKeyResult,
  TSendNotificationToUserResponse,
} from './push-notification.type'
import type { TPushNotificationSubscription } from '@/utils/entities/push-notification-subscription.entity'
import type { SendNotificationToUserRequest } from 'protos/generated/notification'

export interface IPushNotificationSubscription {
  subscribeForUser(
    subscription: AddPushSubscriptionDTO,
    user: TUser
  ): Promise<TPushNotificationSubscription | null>
  unsubscribe(subscription: RemovePushSubscriptionDTO, user: TUser): Promise<TSuccess>
  getPublicVapidKey(): Promise<TGetPublicVapidKeyResult>
  getSubscription(query: GetSubscriptionDTO): Promise<TPushNotificationSubscription | null>
}

export interface IPushNotificationGrpcController {
  SendNotificationToUser(
    data: SendNotificationToUserRequest
  ): Promise<TSendNotificationToUserResponse>
}
