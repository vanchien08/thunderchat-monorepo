import { Module } from '@nestjs/common'
import { GroupMemberController } from './group-member.controller'
import { GroupMemberService } from './group-member.service'
import { UserModule } from '@/user/user.module'
import { MessageModule } from '@/message/message.module'

@Module({
  imports: [UserModule, MessageModule],
  providers: [GroupMemberService],
  controllers: [GroupMemberController],
  exports: [GroupMemberService],
})
export class GroupMemberModule {}
