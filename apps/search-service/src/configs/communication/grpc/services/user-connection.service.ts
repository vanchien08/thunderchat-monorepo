import type { UserConnectionService as UserConnectionServiceType } from 'protos/generated/chat'
import { firstValueFrom } from 'rxjs'

export class UserConnectionService {
  constructor(private instance: UserConnectionServiceType) {}

  async checkUserIsOnline(userId: number): Promise<boolean> {
    return (await firstValueFrom(this.instance.CheckUserIsOnline({ userId }))).isOnline
  }
}
