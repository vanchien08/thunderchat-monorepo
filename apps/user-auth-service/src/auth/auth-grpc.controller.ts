import {
  Controller,
  Inject,
  InternalServerErrorException,
  UnauthorizedException,
  forwardRef,
} from '@nestjs/common'
import { AuthService } from '@/auth/auth.service'
import { GrpcMethod } from '@nestjs/microservices'
import type { IAuthGrpcController } from './auth.interface'
import { EGrpcServices } from '@/utils/enums'
import { JWTService } from './jwt/jwt.service'
import {
  CompareHashedPasswordRequest,
  CreateJWTRequest,
  GetHashedPasswordRequest,
  VerifyTokenRequest,
} from 'protos/generated/auth'
import { CredentialService } from './credentials/credentials.service'
import type {
  TJWTPayload,
  TValidateSocketAuthPayload,
  TValidateSocketConnectionPayload,
  TValidateCallSocketAuthPayload,
  TVerifyTokenRes,
} from './auth.type'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import { EAuthMessages } from './auth.message'
import { UserService } from '@/user/user.service'

@Controller()
export class AuthGrpcController implements IAuthGrpcController {
  constructor(
    private readonly authService: AuthService,
    private readonly jwtService: JWTService,
    private readonly credentialsService: CredentialService,
    @Inject(forwardRef(() => UserService))
    private readonly userService: UserService
  ) {}

  @GrpcMethod(EGrpcServices.AUTH_SERVICE, 'ValidateSocketConnection')
  async ValidateSocketConnection(data: TValidateSocketConnectionPayload) {
    await this.authService.validateSocketConnection(JSON.parse(data.handshakeAuthJson))
  }

  @GrpcMethod(EGrpcServices.AUTH_SERVICE, 'ValidateSocketAuth')
  async ValidateSocketAuth(data: TValidateSocketAuthPayload) {
    return {
      clientSocketAuthJson: JSON.stringify(
        await this.authService.validateSocketAuth(JSON.parse(data.handshakeAuthJson))
      ),
    }
  }

  @GrpcMethod(EGrpcServices.AUTH_SERVICE, 'ValidateCallSocketAuth')
  async ValidateCallSocketAuth(data: TValidateCallSocketAuthPayload) {
    return {
      callSocketAuthJson: JSON.stringify(
        await this.authService.validateCallSocketAuth(JSON.parse(data.handshakeAuthJson))
      ),
    }
  }

  @GrpcMethod(EGrpcServices.AUTH_SERVICE, 'VerifyToken')
  async VerifyToken(data: VerifyTokenRequest): Promise<TVerifyTokenRes> {
    console.log('>>> [auth-v] VerifyToken called with data:', data)
    let payload: TJWTPayload
    let user: TUserWithProfile | null | undefined
    try {
      payload = await this.jwtService.verifyToken(data.token)
    } catch (error) {
      console.error('>>> [auth-v] Error verifying token:', error)
      throw new UnauthorizedException(EAuthMessages.AUTHENTICATION_FAILED)
    }
    try {
      user = await this.userService.findUserWithProfileById(payload.user_id)
    } catch (error) {
      console.error('>>> [auth-v] Error fetching user:', error)
      throw new UnauthorizedException(EAuthMessages.AUTHENTICATION_FAILED)
    }
    if (!user) {
      console.error('>>> [auth-v] User not found for ID:', user)
      throw new UnauthorizedException(EAuthMessages.USER_NOT_FOUND)
    }
    if (!user.Profile) {
      console.error('>>> [auth-v] User has no profile for ID:', user)
      throw new InternalServerErrorException(EAuthMessages.USER_HAS_NO_PROFILE)
    }
    const banResult = await this.authService.checkUserBanStatus(user.id)
    if (banResult.isBanned) {
      console.error('>>> [auth-v] User is banned:', banResult)
      throw new UnauthorizedException(banResult.message || EAuthMessages.USER_BANNED)
    }
    console.log('>>> [auth-v] VerifyToken successful for user ID:', user)
    return {
      userJson: JSON.stringify(user),
    }
  }

  @GrpcMethod(EGrpcServices.JWT_SERVICE, 'CreateJWT')
  async CreateJWT(data: CreateJWTRequest) {
    const { jwt_token } = await this.jwtService.createJWT({
      email: data.email,
      user_id: data.userId,
    })
    return {
      jwtToken: jwt_token,
    }
  }

  @GrpcMethod(EGrpcServices.JWT_SERVICE, 'CompareHashedPassword')
  async CompareHashedPassword(data: CompareHashedPasswordRequest) {
    const isValid = await this.credentialsService.compareHashedPassword(
      data.password,
      data.encrypted
    )
    return {
      isValid,
    }
  }

  @GrpcMethod(EGrpcServices.CREDENTIALS_SERVICE, 'GetHashedPassword')
  async GetHashedPassword(data: GetHashedPasswordRequest) {
    const hashedPassword = await this.credentialsService.getHashedPassword(data.plainPassword)
    return {
      hashedPassword,
    }
  }
}
