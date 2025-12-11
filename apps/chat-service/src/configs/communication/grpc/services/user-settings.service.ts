import type { TUserSettings } from '@/utils/entities/user.entity'
import type { UserSettingsService as UserSettingsServiceType } from 'protos/generated/user'
import { firstValueFrom } from 'rxjs'

export class UserSettingsService {
  constructor(private instance: UserSettingsServiceType) {}

  async findByUserId(userId: number): Promise<TUserSettings | null> {
    const userSettingsJson = (await firstValueFrom(this.instance.FindByUserId({ userId })))
      .userSettingsJson
    return userSettingsJson ? (JSON.parse(userSettingsJson) as TUserSettings) : null
  }
}
