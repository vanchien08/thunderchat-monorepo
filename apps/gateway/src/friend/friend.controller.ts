import { Controller, Delete, Get, Query, UseGuards } from '@nestjs/common'
import { FriendService } from './friend.service'
import { GetFriendsByKeywordDTO, GetFriendsDTO, RemoveFriendDTO } from './friend.dto'
import type { IFriendController } from './friend.interface'
import { ERoutes } from '@/utils/enums'
import { AuthGuard } from '@/auth/auth.guard'
import { User } from '@/user/user.decorator'
import type { TUserWithProfile } from '@/utils/entities/user.entity'

@Controller(ERoutes.FRIEND)
@UseGuards(AuthGuard)
export class FriendController implements IFriendController {
  constructor(private friendService: FriendService) {}

  @Get('get-friends')
  async getFriends(@Query() getFriendsPayload: GetFriendsDTO) {
    return await this.friendService.getFriends(getFriendsPayload)
  }

  @Get('get-friends-by-keyword')
  async getFriendsByKeyword(
    @Query() payload: GetFriendsByKeywordDTO,
    @User() user: TUserWithProfile
  ) {
    return await this.friendService.getFriendsByKeyword(payload.keyword, user.id)
  }

  @Delete('remove-friend')
  async removeFriend(@Query() payload: RemoveFriendDTO, @User() user: TUserWithProfile) {
    await this.friendService.removeFriend(user.id, payload.friendId)
    return {
      success: true,
    }
  }
}
