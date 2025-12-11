import { Module } from '@nestjs/common'
import { GroupChatController } from './group-chat.controller'
import { GroupChatService } from './group-chat.service'
import { S3UploadService } from '@/upload/s3-upload.service'
import { UserModule } from '@/user/user.module'
import { GroupMemberService } from '@/group-member/group-member.service'
import { MessageModule } from '@/message/message.module'
import { InviteCodeService } from './invite-code.service'
import { JoinRequestsService } from './join-requests.service'
import { UserConnectionService } from '@/connection/user-connection.service'

@Module({
  imports: [UserModule, MessageModule],
  controllers: [GroupChatController],
  providers: [
    GroupChatService,
    S3UploadService,
    GroupMemberService,
    InviteCodeService,
    JoinRequestsService,
    UserConnectionService,
  ],
  exports: [
    GroupChatService,
    S3UploadService,
    GroupMemberService,
    InviteCodeService,
    JoinRequestsService,
    UserConnectionService,
  ],
})
export class GroupChatModule {}
