import { Controller, Post, Get, Body, Query, UseGuards } from '@nestjs/common'
import { PinService } from './pin.service'
import { PinMessageDTO } from './pin.dto'
import { AuthGuard } from '@/auth/auth.guard'
import { User } from '@/user/user.decorator'

@Controller('pin')
@UseGuards(AuthGuard)
export class PinController {
  // Controller quản lý chức năng ghim tin nhắn đồng bộ trong direct chat
  constructor(private pinService: PinService) {}

  @Post('pin-message')
  async pinOrUnpinMessage(@Body() body: PinMessageDTO, @User('id') userId: number) {
    const { messageId, directChatId, groupChatId, isPinned } = body
    if (directChatId) {
      return await this.pinService.pinOrUnpinMessage(messageId, directChatId, userId, isPinned)
    } else if (groupChatId) {
      return await this.pinService.pinOrUnpinMessageInGroupChat(
        messageId,
        groupChatId,
        userId,
        isPinned
      )
    }
  }

  @Get('pinned-messages')
  async getPinnedMessages(
    @Query('directChatId') directChatId: number,
    @Query('groupChatId') groupChatId: number
  ) {
    // Lấy danh sách tin nhắn đã ghim - đồng bộ cho tất cả user trong cuộc trò chuyện
    return await this.pinService.getPinnedMessages(Number(directChatId), Number(groupChatId))
  }

  @Get('pinned-count')
  async getPinnedCount(
    @Query('directChatId') directChatId: number,
    @Query('groupChatId') groupChatId: number
  ) {
    // Lấy số lượng tin nhắn đã ghim - tổng cộng cho tất cả user trong cuộc trò chuyện
    return await this.pinService.getPinnedCount(Number(directChatId), Number(groupChatId))
  }

  @Get('is-pinned')
  async isMessagePinned(
    @Query('messageId') messageId: number,
    @Query('directChatId') directChatId: number,
    @Query('groupChatId') groupChatId: number
  ) {
    // Kiểm tra tin nhắn có được ghim trong cuộc trò chuyện không
    return await this.pinService.isMessagePinned(
      Number(messageId),
      Number(directChatId),
      Number(groupChatId)
    )
  }
}
