import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common'
import { AuthGuard } from '@/auth/auth.guard'
import { MediaMessageService } from './media-message.service'
import { GetMediaMessagesDTO } from './media-message.dto'
import { ESortOrder } from './media-message.enum'
import type { TGetMediaMessagesResponse } from './media-message.type'
import type { TMediaFilters } from './media-message.type'

@Controller('media-message')
@UseGuards(AuthGuard)
export class MediaMessageController {
  constructor(private mediaMessageService: MediaMessageService) {}

  /**
   * GET /media/:directChatId
   * Get media messages with pagination and filters
   */
  @Get(':directChatId')
  async getMediaMessages(
    @Param('directChatId') directChatId: number,
    @Query() query: GetMediaMessagesDTO // Using DTO
  ): Promise<TGetMediaMessagesResponse> {
    const { type, types, senderId, fromDate, toDate, page = 1, limit = 20, sort = 'desc' } = query

    // Build filters object
    const filters: TMediaFilters = {}

    // Priority: types array > single type
    if (types && types.length > 0) {
      filters.types = types
    } else if (type) {
      filters.type = type
    }

    if (senderId) filters.senderId = senderId
    if (fromDate) filters.fromDate = fromDate
    if (toDate) filters.toDate = toDate

    return this.mediaMessageService.getMediaMessages(
      directChatId,
      filters,
      page,
      limit,
      sort as ESortOrder
    )
  }

  /**
   * GET /media/:directChatId/statistics
   * Get media statistics for a chat
   */
  @Get(':directChatId/statistics')
  async getMediaStatistics(@Param('directChatId') directChatId: number) {
    return this.mediaMessageService.getMediaStatistics(directChatId)
  }
}
