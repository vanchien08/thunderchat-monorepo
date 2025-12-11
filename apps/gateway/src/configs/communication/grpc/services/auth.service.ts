import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { AuthService as AuthServiceType } from 'protos/generated/auth'
import { firstValueFrom } from 'rxjs'

export class AuthService {
  constructor(private instance: AuthServiceType) {}

  async verifyToken(token: string): Promise<TUserWithProfile> {
    return JSON.parse(
      (await firstValueFrom(this.instance.VerifyToken({ token }))).userJson
    ) as TUserWithProfile
  }
}
