import { Module } from '@nestjs/common'
import { UserController } from '@/user/user.controller'
import { UserService } from '@/user/user.service'
import { BlockUserService } from '@/user/block-user.service'
import { UserGrpcController } from './user-grpc.controller'
import { JWTService } from '@/auth/jwt/jwt.service'
import { CredentialService } from '@/auth/credentials/credentials.service'

@Module({
  controllers: [UserController, UserGrpcController],
  providers: [UserService, BlockUserService, JWTService, CredentialService],
  exports: [UserService, BlockUserService],
})
export class UserModule {}
