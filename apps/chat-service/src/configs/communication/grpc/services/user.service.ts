import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { UserService as UserServiceType } from 'protos/generated/user'
import { firstValueFrom } from 'rxjs'

export class UserService {
  constructor(private instance: UserServiceType) {}

  async findUserWithProfileById(userId: number): Promise<TUserWithProfile | null> {
    return JSON.parse(
      (await firstValueFrom(this.instance.FindUserWithProfileById({ userId }))).userJson
    ) as TUserWithProfile
  }
}
