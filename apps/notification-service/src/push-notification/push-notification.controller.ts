import { Controller, Post, Body, Get, Delete, Query } from '@nestjs/common'
import { PushNotificationService } from './push-notification.service'
import type { TUser } from '@/utils/entities/user.entity'
import { User } from '@/user/user.decorator'
import {
  AddPushSubscriptionDTO,
  GetSubscriptionDTO,
  RemovePushSubscriptionDTO,
} from './push-notification.dto'
import { ERoutes } from '@/utils/enums'
import type { IPushNotificationSubscription } from './push-notification.interface'

@Controller(ERoutes.PUSH_NOTIFICATION)
export class PushNotificationController implements IPushNotificationSubscription {
  constructor(private readonly pushService: PushNotificationService) {}

  @Post('subscribe')
  async subscribeForUser(@Body() subscription: AddPushSubscriptionDTO, @User() user: TUser) {
    if (!subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      console.error('>>> [BACKEND] LỖI: KEY BỊ RỖNG! Client đã gửi dữ liệu không hợp lệ.')
    }
    return await this.pushService.addSubscription(subscription, user.id)
  }

  @Delete('unsubscribe')
  async unsubscribe(@Query() subscription: RemovePushSubscriptionDTO, @User() user: TUser) {
    await this.pushService.removeSubscription(subscription.endpoint, user.id)
    return { success: true }
  }

  @Get('get-public-vapid-key')
  async getPublicVapidKey() {
    return this.pushService.getPublicVapidKey()
  }

  @Get('get-subscription')
  async getSubscription(@Query() query: GetSubscriptionDTO) {
    return this.pushService.findSubscriptionByEndpoint(query.endpoint)
  }
}
