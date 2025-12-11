import { PushNotificationSubscription } from '@prisma/client'

export type TPushNotificationSubscription = PushNotificationSubscription

export type TPushSubscriptionEndpoint = TPushNotificationSubscription['endpoint']
