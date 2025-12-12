import { PrismaService } from '@/configs/db/prisma.service'
import type {
  TGroupJoinRequest,
  TGroupJoinRequestWithUser,
} from '@/utils/entities/group-chat.entity'
import { EChatType, EProviderTokens } from '@/utils/enums'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { EJoinRequestStatus } from './group-chat.enum'
import { EGroupMemberMessages } from '@/group-member/group-member.message'
import { GroupMemberService } from '@/group-member/group-member.service'
import { EGroupChatMessages } from './group-chat.message'
import { TUserWithProfile } from '@/utils/entities/user.entity'

@Injectable()
export class JoinRequestsService {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService,
    private readonly groupMemberService: GroupMemberService
  ) {}

  async fetchJoinRequests(
    groupChatId: number,
    status: EJoinRequestStatus = EJoinRequestStatus.PENDING
  ): Promise<TGroupJoinRequestWithUser[]> {
    const joinRequests = await this.prismaService.groupJoinRequest.findMany({
      where: {
        groupChatId,
        status,
      },
      include: {
        Requester: {
          include: {
            Profile: true,
          },
        },
      },
    })
    return joinRequests
  }

  async createJoinRequest(groupChatId: number, userId: number): Promise<TGroupJoinRequestWithUser> {
    // Kiểm tra xem đã là thành viên của nhóm chưa
    const isMember = await this.prismaService.groupChatMember.findFirst({
      where: {
        groupChatId,
        userId,
      },
    })
    if (isMember) {
      throw new BadRequestException(EGroupMemberMessages.USER_ALREADY_A_MEMBER_OF_GROUP)
    }
    const existingJoinRequest = await this.prismaService.groupJoinRequest.findFirst({
      where: {
        groupChatId,
        userId,
      },
    })
    if (existingJoinRequest && existingJoinRequest.status === EJoinRequestStatus.PENDING) {
      throw new BadRequestException(EGroupChatMessages.USER_ALREADY_HAS_REQUESTED_TO_JOIN_GROUP)
    }
    const joinRequest = await this.prismaService.groupJoinRequest.create({
      data: {
        groupChatId,
        userId,
      },
      include: {
        Requester: {
          include: {
            Profile: true,
          },
        },
      },
    })
    return joinRequest
  }

  async processJoinRequest(
    joinRequestId: number,
    status: EJoinRequestStatus,
    executor: TUserWithProfile
  ): Promise<TGroupJoinRequest> {
    const joinRequest = await this.prismaService.groupJoinRequest.update({
      where: { id: joinRequestId },
      data: { status },
      include: {
        Requester: {
          include: {
            Profile: true,
          },
        },
        GroupChat: true,
      },
    })
    if (joinRequest.status === EJoinRequestStatus.APPROVED) {
      const addedMembers = await this.groupMemberService.addMembersToGroupChat(
        joinRequest.groupChatId,
        [joinRequest.userId],
        joinRequest.Requester
      )
      //>>> event emitter
      // for (const member of addedMembers) {
      //   const clientSockets = this.userConnectionService.getConnectedClient(member.userId)
      //   if (clientSockets && clientSockets.length > 0) {
      //     for (const clientSocket of clientSockets) {
      //       clientSocket.emit(
      //         EMessagingEmitSocketEvents.new_conversation,
      //         null,
      //         joinRequest.GroupChat,
      //         EChatType.GROUP,
      //         null,
      //         executor
      //       )
      //     }
      //   }
      // }
    }
    return joinRequest
  }
}
