import { Module } from '@nestjs/common'
import { FriendRequestController } from './friend-request.controller'
import { FriendRequestService } from './friend-request.service'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'
import { UserModule } from '@/user/user.module'

@Module({
  imports: [GrpcClientModule, UserModule],
  controllers: [FriendRequestController],
  providers: [FriendRequestService],
})
export class FriendRequestModule {}
