import { Request } from 'express'
import { EClientCookieNames } from '@/utils/enums'
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  InternalServerErrorException,
} from '@nestjs/common'
import type { TJWTPayload } from './auth.type'
import { JWTService } from './jwt/jwt.service'
import { UserService } from '@/user/user.service'
import { EAuthMessages } from './auth.message'
import { TUserWithProfile } from '@/utils/entities/user.entity'
import { AuthService } from './auth.service'

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private jwtService: JWTService,
    private userService: UserService,
    private authService: AuthService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.authenticateUser(context)
    return true
  }

  private async authenticateUser(context: ExecutionContext): Promise<void> {
    const req = context.switchToHttp().getRequest<Request>()
    const token = this.extractToken(req)

    if (!token) {
      throw new UnauthorizedException(EAuthMessages.TOKEN_NOT_FOUND)
    }

    let payload: TJWTPayload
    let user: TUserWithProfile | null | undefined
    try {
      payload = await this.jwtService.verifyToken(token)
    } catch (error) {
      throw new UnauthorizedException(EAuthMessages.AUTHENTICATION_FAILED)
    }
    try {
      user = await this.userService.findUserWithProfileById(payload.user_id)
    } catch (error) {
      throw new UnauthorizedException(EAuthMessages.AUTHENTICATION_FAILED)
    }
    if (!user) {
      throw new UnauthorizedException(EAuthMessages.USER_NOT_FOUND)
    }
    if (!user.Profile) {
      throw new InternalServerErrorException(EAuthMessages.USER_HAS_NO_PROFILE)
    }
    const banResult = await this.authService.checkUserBanStatus(user.id)
    if (banResult.isBanned) {
      throw new UnauthorizedException(banResult.message || EAuthMessages.USER_BANNED)
    }

    req['user'] = user
  }

  private extractToken(req: Request): string | undefined {
    return req.cookies[EClientCookieNames.JWT_TOKEN_AUTH] || undefined
  }
}
