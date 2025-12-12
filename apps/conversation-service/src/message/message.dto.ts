import { Type } from 'class-transformer'
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional } from 'class-validator'
import { ESortTypes } from '@/utils/enums'
import type { TMessageOffset } from './message.type'
import { ToBoolean } from '@/utils/validation/transformers'

export class FetchMsgsParamsDTO {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  msgOffset?: TMessageOffset

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  directChatId: number

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  limit: number

  @IsOptional()
  @IsEnum(ESortTypes)
  sortType?: ESortTypes

  @IsNotEmpty()
  @IsBoolean()
  @ToBoolean()
  isFirstTime: boolean
}

export class FetchMsgsParamsForGroupChatDTO {
  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  msgOffset?: TMessageOffset

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  groupChatId: number

  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  limit: number

  @IsOptional()
  @IsEnum(ESortTypes)
  sortType?: ESortTypes

  @IsNotEmpty()
  @IsBoolean()
  @ToBoolean()
  isFirstTime: boolean
}

export class FetchNewerMsgsParamsDTO {
  @IsNumber()
  directChatId: number

  @IsOptional()
  @IsNumber()
  msgOffset?: number // ID hoặc createdAt của tin nhắn cuối cùng đã có

  @IsOptional()
  @IsNumber()
  limit?: number = 20 // Số lượng tin nhắn mỗi lần lấy, mặc định 20

  @IsOptional()
  @IsEnum(['ASC', 'DESC'])
  sortType?: 'ASC' | 'DESC' = 'ASC' // Mặc định lấy cũ nhất trước (tin mới hơn ở cuối)
}

export class CheckCanSendMessageDto {
  @IsNumber()
  @Type(() => Number)
  @IsNotEmpty()
  receiverId: number
}
