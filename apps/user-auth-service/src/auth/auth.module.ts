import { Module, forwardRef } from '@nestjs/common'
import { AuthController } from '@/auth/auth.controller'
import { AuthService } from '@/auth/auth.service'
import { JWTService } from '@/auth/jwt/jwt.service'
import { CredentialService } from './credentials/credentials.service'
import { AdminRoleModule } from './role/admin/admin.module'
import { AuthGrpcController } from './auth-grpc.controller'
import { UserModule } from '@/user/user.module'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'

@Module({
  imports: [AdminRoleModule, forwardRef(() => UserModule), GrpcClientModule],
  controllers: [AuthController, AuthGrpcController],
  providers: [AuthService, JWTService, CredentialService],
  exports: [AuthService, JWTService, CredentialService],
})
export class AuthModule {}
