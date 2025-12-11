import { Type } from 'class-transformer'
import { IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator'

export class GetFriendsDTO {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  userId: number

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  limit: number

  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lastFriendId?: number

  @IsOptional()
  search?: string // Thêm trường search để hỗ trợ tìm kiếm
}

export class GetFriendsByKeywordDTO {
  @IsNotEmpty()
  @IsString()
  keyword: string
}

export class RemoveFriendDTO {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  friendId: number
}
