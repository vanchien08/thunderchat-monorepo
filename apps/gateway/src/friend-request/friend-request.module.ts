import { Module } from '@nestjs/common'
import { FriendRequestController } from './friend-request.controller'
import { FriendRequestService } from './friend-request.service'
import { UserConnectionModule } from '@/connection/user-connection.module'
import { UserModule } from '@/user/user.module'

@Module({
  imports: [UserModule, UserConnectionModule],
  controllers: [FriendRequestController],
  providers: [FriendRequestService],
})
export class FriendRequestModule {}
