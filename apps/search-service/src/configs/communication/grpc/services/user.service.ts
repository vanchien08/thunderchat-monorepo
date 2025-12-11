import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { UserService as userServiceType } from '../../../../../protos/generated/user'
import { firstValueFrom } from 'rxjs'

export class UserService {
  constructor(private instance: userServiceType) {}

  async findUsersForGlobalSearch(
    ids: number[],
    selfUserId: number,
    limit: number
  ): Promise<TUserWithProfile[]> {
    const usersJson = (
      await firstValueFrom(
        this.instance.findUsersForGlobalSearch({
          ids,
          selfUserId,
          limit,
        })
      )
    ).usersJson
    return usersJson.map((user) => JSON.parse(user) as TUserWithProfile)
  }
}
