import { Controller } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import { PushNotificationService } from './push-notification.service'
import type { TPushNotificationData } from './push-notification.type'
import type { IPushNotificationGrpcController } from './push-notification.interface'
import { EGrpcPackages, EGrpcServices } from '@/utils/enums'
import { SendNotificationToUserRequest } from 'protos/generated/notification'

@Controller()
export class PushNotificationGrpcController implements IPushNotificationGrpcController {
  constructor(private readonly pushNotificationService: PushNotificationService) {}

  @GrpcMethod(EGrpcServices.NOTIFICATION_SERVICE, 'SendNotificationToUser')
  async SendNotificationToUser(data: SendNotificationToUserRequest) {
    const notificationResult = await this.pushNotificationService.sendNotificationToUser(
      JSON.parse(data.payloadJson) as TPushNotificationData,
      data.userId
    )
    return { resultJson: JSON.stringify(notificationResult) }
  }
}
