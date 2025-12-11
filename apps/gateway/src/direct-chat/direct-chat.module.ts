import { DirectChatController } from '@/direct-chat/direct-chat.controller'
import { DirectChatService } from './direct-chat.service'
import { Module } from '@nestjs/common'
import { JWTService } from '@/auth/jwt/jwt.service'
import { CredentialService } from '@/auth/credentials/credentials.service'
import { UserModule } from '@/user/user.module'
import { SyncDataToESModule } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.module'

@Module({
  imports: [UserModule, SyncDataToESModule],
  controllers: [DirectChatController],
  providers: [DirectChatService, JWTService, CredentialService],
  exports: [DirectChatService],
})
export class DirectChatsModule {}
