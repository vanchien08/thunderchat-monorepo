import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common'
import { UserSettingsService } from './user-settings.service'
import { UpdateUserSettingsDto } from './user-settings.dto'
import { UserSettingsResponse } from './user-settings.type'
import { User } from '@/user/user.decorator'
import { AuthGuard } from '@/auth/auth.guard'

@Controller('user-settings')
@UseGuards(AuthGuard)
export class UserSettingsController {
  constructor(private readonly userSettingsService: UserSettingsService) {}

  @Get('me')
  async getMySettings(@User('id') userId: number): Promise<UserSettingsResponse> {
    return this.userSettingsService.getUserSettings(userId)
  }

  @Put('me')
  async updateMySettings(
    @Body() dto: UpdateUserSettingsDto,
    @User('id') userId: number
  ): Promise<UserSettingsResponse> {
    return this.userSettingsService.updateUserSettings(userId, dto)
  }
}
