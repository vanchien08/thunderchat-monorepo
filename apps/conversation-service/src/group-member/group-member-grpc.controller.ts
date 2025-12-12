import { Controller, Injectable } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import { GroupMemberService } from './group-member.service'
import type { IGroupMemberGrpcService } from './group-member.interface'
import type {
  TFindMemberInGroupChatRequest,
  TFindGroupChatMemberIdsRequest,
} from './group-member.type'
import { EGrpcServices } from '@/utils/enums'

@Controller()
@Injectable()
export class GroupMemberGrpcController implements IGroupMemberGrpcService {
  constructor(private readonly groupMemberService: GroupMemberService) {}

  @GrpcMethod(EGrpcServices.GROUP_MEMBER_SERVICE, 'FindMemberInGroupChat')
  async findMemberInGroupChat(request: TFindMemberInGroupChatRequest) {
    const groupChatMember = await this.groupMemberService.findMemberInGroupChat(
      request.groupChatId,
      request.userId
    )

    return {
      groupChatMemberJson: groupChatMember ? JSON.stringify(groupChatMember) : undefined,
    }
  }

  @GrpcMethod('GroupMemberService', 'FindGroupChatMemberIds')
  async findGroupChatMemberIds(request: TFindGroupChatMemberIdsRequest) {
    const memberIds = await this.groupMemberService.findGroupChatMemberIds(request.groupChatId)

    return {
      memberIds: memberIds,
    }
  }
}
