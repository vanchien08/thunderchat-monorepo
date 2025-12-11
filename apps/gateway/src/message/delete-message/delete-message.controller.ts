import { Controller, Patch, Param, UseGuards } from '@nestjs/common'
import { DeleteMessageService } from './delete-message.service'
import { User } from '@/user/user.decorator'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import { AuthGuard } from '@/auth/auth.guard'

@UseGuards(AuthGuard)
@Controller('delete-message')
export class DeleteMessageController {
  constructor(private deleteMessageService: DeleteMessageService) {}

  @Patch(':messageId')
  async recallMessage(@Param('messageId') messageId: number, @User() user: TUserWithProfile) {
    return this.deleteMessageService.recallMessage(Number(messageId), user.id)
  }
}
