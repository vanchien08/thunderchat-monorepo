import type { TUserWithProfile } from '@/utils/entities/user.entity'
import type { TRequestWithUserProfile } from '@/utils/types'
import { createParamDecorator, ExecutionContext } from '@nestjs/common'

export const User = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<TRequestWithUserProfile>()
  const user = request.user satisfies TUserWithProfile

  if (data) {
    return user[data as keyof TUserWithProfile]
  }

  return user
})
