import { DirectChatController } from '@/direct-chat/direct-chat.controller'
import { DirectChatService } from './direct-chat.service'
import { Module } from '@nestjs/common'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'
import { DirectChatGrpcController } from './direct-chat-grpc.controller'
import { EncryptMessageService } from '@/message/security/encrypt-message.service'

@Module({
  imports: [GrpcClientModule],
  controllers: [DirectChatController, DirectChatGrpcController],
  providers: [DirectChatService, EncryptMessageService],
  exports: [DirectChatService],
})
export class DirectChatsModule {}
