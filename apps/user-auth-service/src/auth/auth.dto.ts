import type { TMessageOffset } from '@/message/message.type'
import type { TUserId } from '@/user/user.type'
import { TProfile } from '@/utils/entities/profile.entity'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import { EAppRoles } from '@/utils/enums'
import { Exclude, Type } from 'class-transformer'
import { IsDate, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'
import { TSocketId } from '@/connection/user-connection.type'

export class LoginUserDTO {
  @IsNotEmpty()
  email: string

  @IsNotEmpty()
  password: string
}

export class AdminLoginDTO {
  @IsNotEmpty()
  email: string

  @IsNotEmpty()
  password: string
}

export class CheckAdminEmailDTO {
  @IsNotEmpty()
  email: string
}

export class CheckAuthDataDTO implements TUserWithProfile {
  id: number
  createdAt: Date
  email: string
  Profile: TProfile // this prop cannot be null, if null, it is a bug
  role: EAppRoles

  @Exclude()
  password: string

  constructor(user: TUserWithProfile) {
    Object.assign(this, user)
  }
}

export class ClientSocketAuthDTO {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  clientId: TUserId

  @IsOptional()
  @IsDate()
  @Type(() => Number)
  messageOffset?: TMessageOffset

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  directChatId?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  groupId?: number
}

export class LogoutPayloadDTO {
  @IsOptional()
  @IsString()
  socketId?: TSocketId
}

export class CallSocketAuthDTO {
  @IsNumber()
  @Type(() => Number)
  userId: TUserId
}
