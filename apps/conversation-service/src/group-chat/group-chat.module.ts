import { Module } from '@nestjs/common'
import { GroupChatController } from './group-chat.controller'
import { GroupChatService } from './group-chat.service'
import { InviteCodeService } from './invite-code.service'
import { JoinRequestsService } from './join-requests.service'
import { GroupMemberService } from '@/group-member/group-member.service'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'
import { GroupChatGrpcController } from './group-chat-grpc.controller'
import { EncryptMessageService } from '@/message/security/encrypt-message.service'

@Module({
  imports: [GrpcClientModule],
  controllers: [GroupChatController, GroupChatGrpcController],
  providers: [
    GroupChatService,
    GroupMemberService,
    InviteCodeService,
    JoinRequestsService,
    EncryptMessageService,
  ],
  exports: [GroupChatService, GroupMemberService, InviteCodeService, JoinRequestsService],
})
export class GroupChatModule {}
