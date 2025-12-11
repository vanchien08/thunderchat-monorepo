import type {
  TPushNotificationData,
  TWebPushSendNotificationResult,
} from '@/configs/push-notification/push-notification.type'
import type { TUserId } from '@/user/user.type'
import type { NotificationService as NotificationServiceType } from 'protos/generated/notification'
import { firstValueFrom } from 'rxjs'

export class PushNotificationService {
  constructor(private instance: NotificationServiceType) {}

  async sendNotificationToUser(
    payload: TPushNotificationData,
    userId: TUserId
  ): Promise<TWebPushSendNotificationResult> {
    return JSON.parse(
      (
        await firstValueFrom(
          this.instance.SendNotificationToUser({
            userId,
            payloadJson: JSON.stringify(payload),
          })
        )
      ).resultJson
    ) as TWebPushSendNotificationResult
  }
}
