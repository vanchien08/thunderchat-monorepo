import type { UserConnectionService as UserConnectionServiceType } from 'protos/generated/chat'
import { firstValueFrom } from 'rxjs'

export class UserConnectionService {
  constructor(private instance: UserConnectionServiceType) {}

  async getConnectedClientsCountForAdmin(): Promise<number> {
    return (await firstValueFrom(this.instance.GetConnectedClientsCountForAdmin({}))).count
  }
}
