import { Controller, Put, Body, Get } from '@nestjs/common'
import { ProfileService } from './profile.service'
import { UpdateProfileDto } from './profile.dto'
import { ERoutes } from '@/utils/enums'
import { User } from '@/user/user.decorator'
import type { TUser } from '@/utils/entities/user.entity'

@Controller(ERoutes.PROFILE)
export class ProfileController {
  constructor(private profileService: ProfileService) {}

  @Put('update')
  async updateProfile(@User() user: TUser, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(user.id, dto)
  }

  @Get()
  async getProfile(@User() user: TUser) {
    return this.profileService.getProfile(user.id)
  }
}
