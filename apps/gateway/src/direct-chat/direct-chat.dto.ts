import { IsNotEmpty, IsNumber, IsOptional } from 'class-validator'
import { Type } from 'class-transformer'

export class FetchDirectChatDTO {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  conversationId: number
}

export class FetchDirectChatsDTO {
  @IsOptional()
  @IsNumber()
  @Type(() => Number)
  lastId?: number

  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  limit: number
}

export class FindConversationWithOtherUserDTO {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  otherUserId: number
}

export class CreateDirectChatDTO {
  recipientId: number // id của user muốn tạo chat cùng
}

export class DeleteDirectChatDTO {
  @IsNotEmpty()
  @IsNumber()
  @Type(() => Number)
  directChatId: number
}
