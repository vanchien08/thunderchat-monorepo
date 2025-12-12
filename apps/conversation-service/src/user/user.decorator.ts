import type { TUserWithProfile } from '@/utils/entities/user.entity'
import { ERequestXHeaders } from '@/utils/enums'
import { BadRequestException, createParamDecorator, ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { EUserMessages } from './user.message'
import { extractStringXHeader } from '@/utils/helpers'

export const User = createParamDecorator((data: string | undefined, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<Request>()
  const userString = extractStringXHeader(request, ERequestXHeaders.X_USER_DATA)
  if (!userString) {
    throw new BadRequestException(EUserMessages.USER_DATA_REQUIRED)
  }
  const user = JSON.parse(userString) as TUserWithProfile
  if (data) {
    return user[data]
  }
  return user
})
