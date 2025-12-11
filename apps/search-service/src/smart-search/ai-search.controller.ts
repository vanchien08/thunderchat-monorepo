import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common'
import { RagService } from './rag/rag.service'
import type { TUser } from '@/utils/entities/user.entity'
import { User } from '@/user/user.decorator'
import { ERoutes } from '@/utils/enums'
class SearchQueryDto {
  query: string
  startDate?: string
  endDate?: string
  authorId?: number
  // chatId?: number
}

@Controller(ERoutes.SMART_SEARCH)
export class AiSearchController {
  constructor(private ragService: RagService) {}

  @Post('search')
  async search(@Body() dto: SearchQueryDto, @User() user: TUser) {
    const userId = user.id

    const options: any = {}
    if (dto.startDate) options.startDate = new Date(dto.startDate)
    if (dto.endDate) options.endDate = new Date(dto.endDate)
    if (dto.authorId) options.authorId = dto.authorId
    // if (dto.chatId) options.chatId = dto.chatId

    return await this.ragService.search(dto.query, userId, options)
  }
}
