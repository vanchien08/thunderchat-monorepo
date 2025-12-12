import { Type } from 'class-transformer'
import { IsBoolean, IsEnum, IsNotEmpty, IsNumber, IsOptional, IsArray } from 'class-validator'
import { EMessageMediaTypes } from '../message.enum'

export class GetMediaMessagesDTO {
  @IsOptional()
  @IsEnum(EMessageMediaTypes)
  type?: EMessageMediaTypes

  @IsOptional()
  @IsArray()
  @IsEnum(EMessageMediaTypes, { each: true })
  types?: EMessageMediaTypes[]

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  senderId?: number

  @IsOptional()
  fromDate?: string // YYYY-MM-DD format

  @IsOptional()
  toDate?: string // YYYY-MM-DD format

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  page?: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  limit?: number

  @IsOptional()
  @IsEnum(['asc', 'desc'])
  sort?: 'asc' | 'desc'
}
