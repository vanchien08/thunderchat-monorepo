import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common'
import { IPinConversation } from './pin-conversation.interface'
import { ERoutes } from '@/utils/enums'
import { PinConversationService } from './pin-conversation.service'
import { User } from '@/user/user.decorator'
import { TUser } from '@/utils/entities/user.entity'
import { TogglePinConversationPayloadDTO } from './pin-conversation.dto'
import { AuthGuard } from '@/auth/auth.guard'

@Controller(ERoutes.PIN_CONVERSATION)
@UseGuards(AuthGuard)
export class PinConversationController implements IPinConversation {
  constructor(private readonly pinConversationService: PinConversationService) {}

  @Post('toggle-pin-conversation')
  async togglePinConversation(@User() user: TUser, @Body() body: TogglePinConversationPayloadDTO) {
    return this.pinConversationService.togglePinConversation(
      user.id,
      body.directChatId,
      body.groupChatId
    )
  }

  @Get('get-pinned-chats-by-user')
  async getPinnedChatsByUser(@User() user: TUser) {
    return this.pinConversationService.getPinnedChatsByUser(user.id)
  }
}
