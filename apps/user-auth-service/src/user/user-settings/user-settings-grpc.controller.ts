import { EGrpcServices } from '@/utils/enums'
import { Controller } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import { FindByUserIdRequest } from 'protos/generated/user'
import type { IUserSettingsGrpcController } from './user-settings.interface'
import { UserSettingsService } from './user-settings.service'

@Controller()
export class UserSettingsGrpcController implements IUserSettingsGrpcController {
  constructor(private userSettingsService: UserSettingsService) {}

  @GrpcMethod(EGrpcServices.USER_SETTINGS_SERVICE, 'FindByUserId')
  async FindByUserId(data: FindByUserIdRequest) {
    const userSettings = await this.userSettingsService.findByUserId(data.userId)
    return {
      userSettingsJson: userSettings ? JSON.stringify(userSettings) : null,
    }
  }

  @GrpcMethod(EGrpcServices.USER_SETTINGS_SERVICE, 'GetUserVoiceSettings')
  async GetUserVoiceSettings(data: { userId: number }) {
    const userSettings = await this.userSettingsService.findByUserId(data.userId)
    const voiceSettings = {
      ttsEnabled: true,
      sttEnabled: true,
      autoReadMessages: userSettings?.pushNotificationEnabled ?? true,
      speechRate: 1.0,
    }
    return {
      settingsJson: JSON.stringify(voiceSettings),
    }
  }
}
