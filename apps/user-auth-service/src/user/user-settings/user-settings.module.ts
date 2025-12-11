import { Module } from '@nestjs/common'
import { UserSettingsService } from './user-settings.service'
import { UserSettingsController } from './user-settings.controller'
import { UserModule } from '../user.module'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'
import { UserSettingsGrpcController } from './user-settings-grpc.controller'

@Module({
  imports: [UserModule, GrpcClientModule],
  providers: [UserSettingsService],
  controllers: [UserSettingsController, UserSettingsGrpcController],
  exports: [UserSettingsService],
})
export class UserSettingsModule {}
