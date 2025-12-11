import { Module } from '@nestjs/common'
import { CallGateway } from './call.gateway'
import { CallService } from './call.service'
import { UserConnectionService } from '@/connection/user-connection.service'
import { AuthService } from '@/auth/auth.service'
import { UserConnectionModule } from '@/connection/user-connection.module'
import { UserModule } from '@/user/user.module'
import { CallConnectionService } from '@/connection/voice-call-connection.service'

@Module({
  imports: [UserConnectionModule, UserModule],
  providers: [CallGateway, CallService, UserConnectionService, AuthService, CallConnectionService],
})
export class CallGatewayModule {}
