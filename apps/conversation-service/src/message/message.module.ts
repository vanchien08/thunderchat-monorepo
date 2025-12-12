import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'
import { MessageController } from '@/message/message.controller'
import { MessageService } from '@/message/message.service'
import { Module } from '@nestjs/common'
import { MessageGrpcController } from './message-grpc.controller'
import { DeleteMessageModule } from './delete-message/delete-message.module'
import { MediaMessageModule } from './media-message/media-message.module'
import { PinModule } from './pin/pin.module'
import { StickersModule } from './stickers/stickers.module'
import { EncryptMessageService } from './security/encrypt-message.service'

@Module({
  imports: [GrpcClientModule, DeleteMessageModule, MediaMessageModule, PinModule, StickersModule],
  providers: [MessageService, EncryptMessageService],
  controllers: [MessageController, MessageGrpcController],
  exports: [MessageService],
})
export class MessageModule {}
