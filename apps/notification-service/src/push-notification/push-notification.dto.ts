import { IsISO8601, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

class KeysDTO {
  @IsString()
  p256dh: string

  @IsString()
  auth: string
}

export class AddPushSubscriptionDTO {
  @IsString()
  endpoint: string

  @IsISO8601()
  @IsOptional()
  expirationTime?: string

  @IsObject()
  @ValidateNested()
  @Type(() => KeysDTO)
  keys: KeysDTO
}

export class RemovePushSubscriptionDTO {
  @IsString()
  endpoint: string
}

export class GetSubscriptionDTO {
  @IsString()
  endpoint: string
}
