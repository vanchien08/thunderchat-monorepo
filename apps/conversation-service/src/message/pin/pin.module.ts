import { Module } from '@nestjs/common'
import { PinService } from './pin.service'
import { PinController } from './pin.controller'
import { PrismaModule } from '../../configs/db/prisma.module'
import { GroupChatModule } from '@/group-chat/group-chat.module'
import { GroupMemberModule } from '@/group-member/group-member.module'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'
import { EncryptMessageService } from '../security/encrypt-message.service'
import { MessageService } from '../message.service'

@Module({
  imports: [PrismaModule, GroupChatModule, GroupMemberModule, GrpcClientModule],
  providers: [PinService, EncryptMessageService, MessageService],
  controllers: [PinController],
  exports: [PinService],
})
export class PinModule {}
