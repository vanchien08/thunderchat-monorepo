import { Module } from '@nestjs/common'
import { MediaMessageController } from './media-message.controller'
import { MediaMessageService } from './media-message.service'
import { AuthModule } from '@/auth/auth.module'
import { UserModule } from '@/user/user.module'

@Module({
  imports: [AuthModule, UserModule],
  providers: [MediaMessageService],
  controllers: [MediaMessageController],
  exports: [MediaMessageService],
})
export class MediaMessageModule {}
