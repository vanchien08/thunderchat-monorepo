import { BadRequestException, Body, Controller, Post, UseGuards } from '@nestjs/common'
import { SearchService } from './search.service'
import type { ISearchController } from './search.interface'
import { GlobalSearchPayloadDTO, SearchConversationsPayloadDTO } from './search.dto'
import { User } from '@/user/user.decorator'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import { AuthGuard } from '@/auth/auth.guard'
import { ERoutes } from '@/utils/enums'
import { DevLogger } from '@/dev/dev-logger'

@Controller(ERoutes.SEARCH)
@UseGuards(AuthGuard)
export class SearchController implements ISearchController {
  constructor(private readonly searchService: SearchService) {}

  @Post('global-search')
  async searchGlobally(
    @Body() searchPayload: GlobalSearchPayloadDTO,
    @User() user: TUserWithProfile
  ) {
    const { keyword, messageSearchOffset, userSearchOffset, limit } = searchPayload
    const searchResult = await this.searchService.searchGlobally(
      keyword,
      user.id,
      limit,
      user.id,
      messageSearchOffset,
      userSearchOffset
    )
    return searchResult
  }

  @Post('conversations')
  async searchConversations(
    @Body() searchPayload: SearchConversationsPayloadDTO,
    @User() user: TUserWithProfile
  ) {
    const { keyword, limit = 10 } = searchPayload
    DevLogger.logInfo('searchConversationsPayload:', searchPayload)

    return await this.searchService.searchConversations(keyword, user.id, limit)
  }
}
