import type { TBlockedUserFullInfo } from '@/utils/entities/user.entity'
import type { BlockUserService as BlockUserServiceType } from 'protos/generated/user'
import { firstValueFrom } from 'rxjs'

export class BlockUserService {
  constructor(private instance: BlockUserServiceType) {}

  async checkBlockedUser(
    blockerId: number,
    blockedId: number
  ): Promise<TBlockedUserFullInfo | null> {
    const blockedUserJson = (
      await firstValueFrom(this.instance.CheckBlockedUser({ blockerId, blockedId }))
    ).blockedUserJson
    if (!blockedUserJson) {
      return null
    }
    return JSON.parse(blockedUserJson) as TBlockedUserFullInfo | null
  }
}
