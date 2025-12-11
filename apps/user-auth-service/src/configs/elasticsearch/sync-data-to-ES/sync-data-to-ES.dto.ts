import type { TMessage, TMessageWithMedia } from '@/utils/entities/message.entity'
import { TUserWithProfile } from '@/utils/entities/user.entity'
import { ESyncDataToESWorkerType } from '@/utils/enums'
import { IsEnum } from 'class-validator'

export class SyncDataToESWorkerMessageDTO {
  @IsEnum(ESyncDataToESWorkerType)
  type: ESyncDataToESWorkerType

  message?: TMessageWithMedia
  user?: TUserWithProfile
  messageIds?: TMessage['id'][]
}
