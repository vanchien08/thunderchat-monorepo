import { Type } from 'class-transformer'
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional } from 'class-validator'

// DTO cho chức năng ghim tin nhắn đồng bộ trong direct chat

export class PinMessageDTO {
  // DTO cho request ghim/bỏ ghim tin nhắn
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  messageId: number // ID của tin nhắn cần ghim/bỏ ghim

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  directChatId?: number // ID của cuộc trò chuyện

  @IsBoolean()
  @IsNotEmpty()
  @Type(() => Boolean)
  isPinned: boolean // Trạng thái ghim (true: ghim, false: bỏ ghim)

  @IsNumber()
  @IsOptional()
  @Type(() => Number)
  groupChatId: number // ID của nhóm
}

export class PinnedCountDTO {
  // DTO cho request lấy số lượng tin nhắn đã ghim
  @IsNumber()
  @IsNotEmpty()
  @Type(() => Number)
  directChatId: number // ID của cuộc trò chuyện
}
