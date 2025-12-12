import { Controller, Patch, Param } from '@nestjs/common'
import { DeleteMessageService } from './delete-message.service'
import { User } from '@/user/user.decorator'
import type { TUserWithProfile } from '@/utils/entities/user.entity'

@Controller('delete-message')
export class DeleteMessageController {
  constructor(private deleteMessageService: DeleteMessageService) {}

  @Patch(':messageId')
  async recallMessage(@Param('messageId') messageId: number, @User() user: TUserWithProfile) {
    return this.deleteMessageService.recallMessage(Number(messageId), user.id)
  }
}
