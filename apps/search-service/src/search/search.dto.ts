import { IsArray, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'
import { Type } from 'class-transformer'
import type { TMessageSearchOffset, TUserSearchOffset } from './search.type'

export class GlobalSearchPayloadDTO {
  @IsNotEmpty()
  @IsString()
  keyword: string

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  limit: number

  @IsOptional()
  @IsArray()
  @IsNotEmpty({ each: true })
  messageSearchOffset?: TMessageSearchOffset

  @IsOptional()
  @IsArray()
  @IsNotEmpty({ each: true })
  userSearchOffset?: TUserSearchOffset
}

export class SearchConversationsPayloadDTO {
  @IsNotEmpty()
  @IsString()
  keyword: string

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number
}
