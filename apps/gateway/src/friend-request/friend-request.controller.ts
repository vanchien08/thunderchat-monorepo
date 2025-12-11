import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common'
import {
   FriendRequestActionDTO,
   GetFriendRequestsDTO,
   SendFriendRequestDTO,
} from './friend-request.dto'
import { FriendRequestService } from './friend-request.service'
import type { IFriendRequestController } from './friend-request.interface'
import { ERoutes } from '@/utils/enums'
import { AuthGuard } from '@/auth/auth.guard'

@Controller(ERoutes.FRIEND_REQUEST)
@UseGuards(AuthGuard)
export class FriendRequestController implements IFriendRequestController {
   constructor(private friendRequestService: FriendRequestService) {}

   @Post('send-friend-request')
   async sendFriendRequest(@Body() sendFriendRequestPayload: SendFriendRequestDTO) {
      const { recipientId, senderId } = sendFriendRequestPayload
      return await this.friendRequestService.sendFriendRequest(senderId, recipientId)
   }

   @Post('friend-request-action')
   async friendRequestAction(@Body() friendRequestActionPayload: FriendRequestActionDTO) {
      await this.friendRequestService.friendRequestAction(friendRequestActionPayload)
      return { success: true }
   }

   @Get('get-friend-requests')
   async getFriendRequests(@Query() getFriendRequestsPayload: GetFriendRequestsDTO) {
      return await this.friendRequestService.getFriendRequests(getFriendRequestsPayload)
   }
}
