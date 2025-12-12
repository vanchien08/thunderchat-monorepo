import { Controller, Injectable } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import { GroupChatService } from './group-chat.service'
import type { IGroupChatGrpcService } from './group-chat.interface'
import type { TCheckGroupChatPermissionRequest } from './group-chat.type'
import { EGroupChatPermissions } from './group-chat.enum'
import { EGrpcServices } from '@/utils/enums'

@Controller()
@Injectable()
export class GroupChatGrpcController implements IGroupChatGrpcService {
  constructor(private readonly groupChatService: GroupChatService) {}

  @GrpcMethod(EGrpcServices.GROUP_CHAT_SERVICE, 'CheckGroupChatPermission')
  async checkGroupChatPermission(request: TCheckGroupChatPermissionRequest) {
    const permission = request.permission as EGroupChatPermissions
    const allowed = await this.groupChatService.checkGroupChatPermission(
      request.groupChatId,
      permission
    )

    return {
      allowed,
    }
  }
}
