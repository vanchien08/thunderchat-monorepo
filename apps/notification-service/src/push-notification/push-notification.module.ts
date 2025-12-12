import { Module } from '@nestjs/common'
import { PushNotificationController } from './push-notification.controller'
import { PushNotificationService } from './push-notification.service'
import { PushNotificationGrpcController } from './push-notification-grpc.controller'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'

@Module({
  imports: [GrpcClientModule],
  controllers: [PushNotificationController, PushNotificationGrpcController],
  providers: [PushNotificationService],
  exports: [PushNotificationService],
})
export class PushNotificationModule {}
