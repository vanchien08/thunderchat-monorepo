import { IsBoolean, IsOptional } from 'class-validator'

export class UpdateUserSettingsDto {
  @IsBoolean()
  @IsOptional()
  onlyReceiveFriendMessage?: boolean

  @IsBoolean()
  @IsOptional()
  pushNotificationEnabled?: boolean
}
