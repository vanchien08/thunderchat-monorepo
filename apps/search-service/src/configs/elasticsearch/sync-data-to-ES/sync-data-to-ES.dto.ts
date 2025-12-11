import type { TMessage } from '@/utils/entities/message.entity'
import { ESyncDataToESWorkerType } from '@/utils/enums'
import { IsEnum } from 'class-validator'
import type { TCastedMessageWithMedia, TCastedUserWithProfile } from './sync-data-to-ES.type'

export class SyncDataToESWorkerMessageDTO {
  @IsEnum(ESyncDataToESWorkerType)
  type: ESyncDataToESWorkerType

  message?: TCastedMessageWithMedia
  user?: TCastedUserWithProfile
  messageIds?: TMessage['id'][]
}
