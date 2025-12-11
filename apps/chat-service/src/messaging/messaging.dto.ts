import { ToBoolean } from '@/utils/validation/transformers'
import { Type } from 'class-transformer'
import {
  IsBoolean,
  IsDate,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator'
import { EMessageTypeAllTypes } from './messaging.enum'

export class SendDirectMessagePayloadDTO {
  @IsNumber()
  @IsNotEmpty()
  receiverId: number

  @IsNotEmpty()
  content: string

  @IsNotEmpty()
  @IsUUID()
  token: string

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  timestamp: Date

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  replyToId?: number
}

export class SendDirectMessageDTO {
  @IsEnum(EMessageTypeAllTypes)
  @IsNotEmpty()
  type: EMessageTypeAllTypes

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => SendDirectMessagePayloadDTO)
  msgPayload: SendDirectMessagePayloadDTO
}

export class MarkAsSeenDTO {
  @IsNumber()
  @IsNotEmpty()
  messageId: number

  @IsNumber()
  @IsNotEmpty()
  receiverId: number
}

export class TypingDTO {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  receiverId: number

  @IsNotEmpty()
  @IsBoolean()
  @ToBoolean()
  isTyping: boolean

  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  directChatId: number
}

export class SendGroupMessagePayloadDTO {
  @IsNumber()
  @IsNotEmpty()
  groupChatId: number

  @IsNotEmpty()
  content: string

  @IsNotEmpty()
  @IsUUID()
  token: string

  @IsNotEmpty()
  @IsDate()
  @Type(() => Date)
  timestamp: Date

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  replyToId?: number
}

export class SendGroupMessageDTO {
  @IsEnum(EMessageTypeAllTypes)
  @IsNotEmpty()
  type: EMessageTypeAllTypes

  @IsNotEmpty()
  @ValidateNested()
  @Type(() => SendGroupMessagePayloadDTO)
  msgPayload: SendGroupMessagePayloadDTO
}

export class JoinGroupChatDTO {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  groupChatId: number
}

export class CheckUserOnlineDTO {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  userId: number
}

export class JoinDirectChatDTO {
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  directChatId: number
}
