import { Module } from '@nestjs/common'
import { PushNotificationController } from './push-notification.controller'
import { PushNotificationService } from './push-notification.service'
import { UserModule } from '@/user/user.module'
import { UserSettingsModule } from '@/user/user-settings/user-settings.module'

@Module({
  imports: [UserModule, UserSettingsModule],
  controllers: [PushNotificationController],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}
