import { Module } from '@nestjs/common'
import { FriendController } from './friend.controller'
import { FriendService } from './friend.service'
import { FriendGrpcController } from './friend.grpc.controller'

@Module({
  controllers: [FriendController, FriendGrpcController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}
