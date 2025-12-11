import type { TMessage, TMessageWithMedia } from '@/utils/entities/message.entity'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import { ESyncDataToESWorkerType } from '@/utils/enums'
import { IsEnum } from 'class-validator'

export class SyncDataToESWorkerMessageDTO {
  @IsEnum(ESyncDataToESWorkerType)
  type: ESyncDataToESWorkerType

  data?: TMessageWithMedia | TUserWithProfile | TMessage['id'][]

  // @IsOptional()
  // msgEncryptor?: UserMessageEncryptor
}
