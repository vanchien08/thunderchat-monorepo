import {
  Controller,
  Post,
  Body,
  Get,
  UseInterceptors,
  ClassSerializerInterceptor,
  UnauthorizedException,
} from '@nestjs/common'
import { EAppRoles, ERoutes } from '@/utils/enums'
import {
  CheckAuthDataDTO,
  LoginUserDTO,
  AdminLoginDTO,
  CheckAdminEmailDTO,
  LogoutPayloadDTO,
} from '@/auth/auth.dto'
import { AuthService } from '@/auth/auth.service'
import type { IAuthController } from './auth.interface'
import { User } from '@/user/user.decorator'
import { TUserWithProfile } from '@/utils/entities/user.entity'
import { EAuthMessages } from './auth.message'

@Controller(ERoutes.AUTH)
export class AuthController implements IAuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginUserPayload: LoginUserDTO) {
    const { jwt_token } = await this.authService.loginUser(loginUserPayload)
    return { jwt_token }
  }

  @Post('admin/login')
  async adminLogin(@Body() adminLoginPayload: AdminLoginDTO) {
    const { jwt_token } = await this.authService.loginAdmin(adminLoginPayload)
    return { jwt_token }
  }

  @Post('admin/check-email')
  async checkAdminEmail(@Body() checkAdminEmailPayload: CheckAdminEmailDTO) {
    const result = await this.authService.checkAdminEmail(checkAdminEmailPayload.email)
    return result
  }

  @Post('logout')
  async logout(@User() user: TUserWithProfile, @Body() reqBody: LogoutPayloadDTO) {
    await this.authService.logoutUser(user.id, reqBody.socketId)
    return { success: true }
  }

  @Post('admin/logout')
  async adminLogout(@User() user: TUserWithProfile) {
    await this.authService.adminLogout(user.id)
    return { success: true }
  }

  @Get('check-auth')
  @UseInterceptors(ClassSerializerInterceptor)
  async checkAuth(@User() user: TUserWithProfile): Promise<CheckAuthDataDTO> {
    return new CheckAuthDataDTO(user)
  }

  @Get('admin/check-auth')
  @UseInterceptors(ClassSerializerInterceptor)
  async checkAdminAuth(@User() user: TUserWithProfile): Promise<CheckAuthDataDTO> {
    if (user.role !== EAppRoles.ADMIN) {
      throw new UnauthorizedException(EAuthMessages.ADMIN_ACCESS_REQUIRED)
    }
    return new CheckAuthDataDTO(user)
  }
}
