import { Body, Controller, Get, Post, Query } from '@nestjs/common'
import {
  ChangePasswordDTO,
  BlockUserDTO,
  CreateUserDTO,
  GetUserByEmailDTO,
  CheckBlockedUserDTO,
  SearchUsersDTO,
  UnblockUserDTO,
  ForgotPasswordDTO,
  VerifyOtpDTO,
  ResetPasswordDTO,
  GetUserByIdDTO,
} from '@/user/user.dto'
import { UserService } from '@/user/user.service'
import { ERoutes } from '@/utils/enums'
import type { IUserController } from './user.interface'
import { User } from './user.decorator'
import { BlockUserService } from '@/user/block-user.service'
import type { TUserWithProfile } from '@/utils/entities/user.entity'

@Controller(ERoutes.USER)
export class UserController implements IUserController {
  constructor(
    private userService: UserService,
    private blockUserService: BlockUserService
  ) {}

  @Post('register')
  async register(@Body() createUserPayload: CreateUserDTO) {
    console.log('>>> [use] register payload:', createUserPayload)
    const { jwt_token } = await this.userService.registerUser(createUserPayload)
    return { jwt_token }
  }

  @Get('get-user')
  async getUser(@Query() getUserByEmailPayload: GetUserByEmailDTO) {
    return await this.userService.getUserByEmail(getUserByEmailPayload.email)
  }
  @Get('get-user-by-id')
  async getUserById(@Query() getUserByIdPayload: GetUserByIdDTO) {
    return await this.userService.getUserById(getUserByIdPayload.id)
  }
  @Get('search-users')
  async searchUsers(@Query() searchUsersPayload: SearchUsersDTO) {
    return await this.userService.searchUsers(searchUsersPayload)
  }

  @Post('change-password')
  async changePassword(@User() user: TUserWithProfile, @Body() dto: ChangePasswordDTO) {
    await this.userService.changePassword(user.id, dto.oldPassword, dto.newPassword)
    return { success: true }
  }

  @Post('block-user')
  async blockUser(@User() user: TUserWithProfile, @Body() dto: BlockUserDTO) {
    await this.blockUserService.blockUser(user.id, dto.blockedUserId)
    return { success: true }
  }

  @Get('check-blocked-user')
  async checkBlockedUser(@User() user: TUserWithProfile, @Query() dto: CheckBlockedUserDTO) {
    return await this.blockUserService.checkBlockedUser(user.id, dto.otherUserId)
  }

  @Post('unblock-user')
  async unblockUser(@User() user: TUserWithProfile, @Body() dto: UnblockUserDTO) {
    await this.blockUserService.unblockUser(user.id, dto.blockedUserId)
    return { success: true }
  }

  @Get('get-blocked-users-list')
  async getBlockedUsersList(@User() user: TUserWithProfile) {
    return await this.blockUserService.getBlockedUsersList(user.id)
  }

  @Post('password/forgot')
  async forgotPassword(@Body() dto: ForgotPasswordDTO) {
    await this.userService.requestPasswordReset(dto.email)
    return { success: true }
  }

  @Post('password/verify-otp')
  async verifyOtp(@Body() dto: VerifyOtpDTO) {
    const { resetToken } = await this.userService.verifyPasswordResetOtp(dto.email, dto.otp)
    return { resetToken }
  }

  @Post('password/reset')
  async resetPassword(@Body() dto: ResetPasswordDTO) {
    await this.userService.resetPasswordWithToken(dto.resetToken, dto.newPassword)
    return { success: true }
  }
}
