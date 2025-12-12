import { Module } from '@nestjs/common'
import { MediaMessageController } from './media-message.controller'
import { MediaMessageService } from './media-message.service'
import { EncryptMessageService } from '../security/encrypt-message.service'

@Module({
  providers: [MediaMessageService, EncryptMessageService],
  controllers: [MediaMessageController],
  exports: [MediaMessageService],
})
export class MediaMessageModule {}
