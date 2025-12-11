import { VoiceActivationMode } from '@/utils/enums'
import { Transform, Type } from 'class-transformer'
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Length,
  Max,
  Min,
} from 'class-validator'

export class UpdateUserSettingsDto {
  @IsBoolean()
  @IsOptional()
  onlyReceiveFriendMessage?: boolean

  @IsBoolean()
  @IsOptional()
  pushNotificationEnabled?: boolean

  // Accessibility
  @IsOptional()
  @IsBoolean()
  voiceAssistantEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  ttsEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  sttEnabled?: boolean

  @IsOptional()
  @IsBoolean()
  autoReadMessages?: boolean

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  @Min(0.5)
  @Max(2.0)
  speechRate?: number

  @IsOptional()
  @IsEnum(VoiceActivationMode)
  voiceActivationMode?: VoiceActivationMode

  @IsOptional()
  @IsString()
  @Length(2, 30)
  @Transform(({ value }) => (value as string)?.trim())
  wakeWordPhrase?: string
}
