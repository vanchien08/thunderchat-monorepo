import { Inject, Injectable } from '@nestjs/common'
import webPush, { WebPushError } from 'web-push'
import { PrismaService } from '@/configs/db/prisma.service'
import { AddPushSubscriptionDTO } from './push-notification.dto'
import type {
  TPushNotificationData,
  TGetPublicVapidKeyResult,
  TWebPushSendNotificationResult,
} from './push-notification.type'
import { DevLogger } from '@/dev/dev-logger'
import type {
  TPushNotificationSubscription,
  TPushSubscriptionEndpoint,
} from '@/utils/entities/push-notification-subscription.entity'
import type { TUserId } from '@/user/user.type'
import { EProviderTokens } from '@/utils/enums'
import { UserSettingsService } from '@/user/user-settings/user-settings.service'

@Injectable()
export class PushNotificationService {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private readonly prismaService: PrismaService,
    private userSettingsService: UserSettingsService
  ) {
    webPush.setVapidDetails(
      process.env.VAPID_MAILTO,
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    )
  }

  async findSubscriptionsByUserId(userId: TUserId): Promise<TPushNotificationSubscription[]> {
    return await this.prismaService.pushNotificationSubscription.findMany({
      where: { userId },
    })
  }

  async findSubscriptionByEndpoint(
    endpoint: TPushSubscriptionEndpoint
  ): Promise<TPushNotificationSubscription | null> {
    return await this.prismaService.pushNotificationSubscription.findUnique({
      where: { endpoint },
    })
  }

  async addSubscription(
    subscriptionData: AddPushSubscriptionDTO,
    userId: TUserId
  ): Promise<TPushNotificationSubscription | null> {
    const existing = await this.findSubscriptionByEndpoint(subscriptionData.endpoint)
    if (!existing) {
      const { endpoint, keys, expirationTime } = subscriptionData
      let subscription: TPushNotificationSubscription | null = null
      await this.prismaService.$transaction(async (tx) => {
        subscription = await tx.pushNotificationSubscription.create({
          data: {
            endpoint,
            p256dh: keys.p256dh,
            auth: keys.auth,
            expirationTime: expirationTime ? new Date(expirationTime) : undefined,
            userId,
          },
        })
        await tx.userSettings.upsert({
          where: { userId },
          update: { pushNotificationEnabled: true },
          create: { userId, pushNotificationEnabled: true },
        })
      })
      return subscription
    }
    return existing
  }

  async removeSubscription(endpoint: TPushSubscriptionEndpoint, userId: TUserId): Promise<void> {
    await this.prismaService.$transaction(async (tx) => {
      await tx.pushNotificationSubscription.delete({ where: { endpoint } })
      const remaining = await tx.pushNotificationSubscription.count({
        where: { userId },
      })
      if (remaining === 0) {
        await tx.userSettings.upsert({
          where: { userId },
          update: { pushNotificationEnabled: false },
          create: { userId, pushNotificationEnabled: false },
        })
      }
    })
  }

  async checkIfUserEnablePushNotification(userId: TUserId): Promise<boolean> {
    const userSettings = await this.userSettingsService.findByUserId(userId)
    return userSettings?.pushNotificationEnabled || false
  }

  checkIfSubscriptionNotFound(error: WebPushError): boolean {
    return error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)
  }

  async sendNotificationToUser(
    payload: TPushNotificationData,
    userId: TUserId
  ): Promise<TWebPushSendNotificationResult> {
    const isEnabled = await this.checkIfUserEnablePushNotification(userId)
    if (!isEnabled) {
      return {
        success: [],
        failure: [],
      }
    }
    const subscriptions = await this.findSubscriptionsByUserId(userId)
    // if (subscriptions.length === 0) {
    //   // DevLogger.log(`No subscriptions found for user ${userId}`);
    //   return { success: [], failure: [] }
    // }
    const successEndpoints: TPushSubscriptionEndpoint[] = []
    const failureEndpoints: TPushSubscriptionEndpoint[] = []
    return await new Promise<TWebPushSendNotificationResult>((resolve, reject) => {
      let count: number = 0
      const subscriptionsCount = subscriptions.length
      for (const subscription of subscriptions) {
        webPush
          .sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            JSON.stringify(payload),
            {
              TTL: payload.ttlInSeconds || 60,
              urgency: payload.urgency || 'normal',
              topic: payload.topic,
            }
          )
          .then(() => {
            successEndpoints.push(subscription.endpoint)
          })
          .catch(async (error) => {
            failureEndpoints.push(subscription.endpoint)
            if (this.checkIfSubscriptionNotFound(error)) {
              this.removeSubscription(subscription.endpoint, userId).catch((err) => {
                DevLogger.logError('Error deleting subscription:', err)
              })
            } else {
              reject(error)
            }
          })
          .finally(() => {
            count++
            if (count === subscriptionsCount) {
              resolve({
                success: successEndpoints,
                failure: failureEndpoints,
              })
            }
          })
      }
    })
  }

  async getPublicVapidKey(): Promise<TGetPublicVapidKeyResult> {
    return {
      publicKey: process.env.VAPID_PUBLIC_KEY,
    }
  }
}
