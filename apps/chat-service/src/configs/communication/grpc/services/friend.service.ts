import type { FriendService as FriendServiceType } from 'protos/generated/friend'
import { firstValueFrom } from 'rxjs'

export class FriendService {
  constructor(private instance: FriendServiceType) {}

  async isFriend(userId: number, friendId: number): Promise<boolean> {
    return (await firstValueFrom(this.instance.IsFriend({ friendId, userId }))).isFriend
  }
}
