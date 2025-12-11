import { Module } from '@nestjs/common'
import { PinConversationController } from './pin-conversation.controller'
import { PinConversationService } from './pin-conversation.service'
import { UserModule } from '@/user/user.module'
import { AuthModule } from '@/auth/auth.module'

@Module({
  imports: [UserModule, AuthModule],
  controllers: [PinConversationController],
  providers: [PinConversationService],
})
export class PinConversationModule {}
