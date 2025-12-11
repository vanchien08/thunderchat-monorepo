import { Inject, Injectable } from '@nestjs/common'
import { PrismaService } from '../../configs/db/prisma.service'
import { UpdateUserSettingsDto } from './user-settings.dto'
import { EProviderTokens } from '@/utils/enums'

@Injectable()
export class UserSettingsService {
  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService) {}

  async findByUserId(userId: number) {
    return this.prismaService.userSettings.findUnique({ where: { userId } })
  }

  async updateUserSettings(userId: number, updates: UpdateUserSettingsDto) {
    // Filter out unsupported fields
    const supportedFields = {
      onlyReceiveFriendMessage: updates.onlyReceiveFriendMessage,
      pushNotificationEnabled: updates.pushNotificationEnabled,
      voiceAssistantEnabled: updates.voiceAssistantEnabled,
      ttsEnabled: updates.ttsEnabled,
      sttEnabled: updates.sttEnabled,
      autoReadMessages: updates.autoReadMessages,
      speechRate: updates.speechRate,
    }

    // Remove undefined values
    const filteredUpdates = Object.fromEntries(
      Object.entries(supportedFields).filter(([_, v]) => v !== undefined)
    )

    return this.prismaService.userSettings.upsert({
      where: { userId },
      update: filteredUpdates,
      create: { userId, ...filteredUpdates },
    })
  }

  async getUserSettings(userId: number) {
    let settings = await this.prismaService.userSettings.findUnique({ where: { userId } })
    if (!settings) {
      settings = await this.prismaService.userSettings.create({
        data: { userId, onlyReceiveFriendMessage: false },
      })
    }
    return settings
  }
}
