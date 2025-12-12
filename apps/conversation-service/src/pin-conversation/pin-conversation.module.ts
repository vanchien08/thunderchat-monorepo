import { Module } from '@nestjs/common'
import { PinConversationController } from './pin-conversation.controller'
import { PinConversationService } from './pin-conversation.service'

@Module({
  controllers: [PinConversationController],
  providers: [PinConversationService],
})
export class PinConversationModule {}
