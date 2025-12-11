import { Module } from '@nestjs/common'
import { FriendController } from './friend.controller'
import { FriendService } from './friend.service'
import { UserModule } from '@/user/user.module'
import { UserConnectionModule } from '@/connection/user-connection.module'

@Module({
  imports: [UserModule, UserConnectionModule],
  controllers: [FriendController],
  providers: [FriendService],
  exports: [FriendService],
})
export class FriendModule {}
