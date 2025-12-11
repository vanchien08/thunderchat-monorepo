import { Module } from '@nestjs/common'
import { UserController } from '@/user/user.controller'
import { UserService } from '@/user/user.service'
import { JWTService } from '@/auth/jwt/jwt.service'
import { AuthService } from '@/auth/auth.service'
import { CredentialService } from '@/auth/credentials/credentials.service'
import { SyncDataToESModule } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.module'
import { MessageMappingModule } from '@/message-mapping/message-mapping.module'
import { UserConnectionModule } from '@/connection/user-connection.module'
import { BlockUserService } from '@/user/block-user.service'

@Module({
  imports: [SyncDataToESModule, MessageMappingModule, UserConnectionModule],
  controllers: [UserController],
  providers: [UserService, JWTService, AuthService, CredentialService, BlockUserService],
  exports: [UserService, JWTService, AuthService, CredentialService, BlockUserService],
})
export class UserModule {}
