import { PrismaService } from '@/configs/db/prisma.service'
import type {
  TGroupChatMember,
  TGroupChatMemberWithUser,
  TGroupChatMemberWithUserAndGroupChat,
} from '@/utils/entities/group-chat-member.entity'
import { EGrpcPackages, EGrpcServices, EProviderTokens } from '@/utils/enums'
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
} from '@nestjs/common'
import { EGroupMemberMessages } from './group-member.message'
import { TUserWithProfile } from '@/utils/entities/user.entity'
import { ClientGrpc } from '@nestjs/microservices'
import { UserConnectionService } from '@/configs/communication/grpc/services/user-connection.service'

@Injectable()
export class GroupMemberService {
  private readonly MAX_ADD_MEMBER_AT_ONCE: number = 10
  private readonly MAX_ADD_MEMBER_TOTAL: number = 1000
  private readonly MIN_MEMBER_IN_GROUP_CHAT: number = 2
  private userConnectionService: UserConnectionService

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService,
    @Inject(EGrpcPackages.CHAT_PACKAGE) private chatClient: ClientGrpc
  ) {
    this.userConnectionService = new UserConnectionService(
      this.chatClient.getService(EGrpcServices.USER_CONNECTION_SERVICE)
    )
  }

  async findGroupChatMemberIds(groupChatId: number): Promise<number[]> {
    const members = await this.prismaService.groupChatMember.findMany({
      where: { groupChatId },
      select: { userId: true },
    })
    return members.map((member) => member.userId)
  }

  async findMemberInGroupChat(
    groupChatId: number,
    userId: number
  ): Promise<TGroupChatMemberWithUserAndGroupChat | null> {
    return await this.prismaService.groupChatMember.findFirst({
      where: { groupChatId, userId },
      include: {
        User: {
          include: { Profile: true },
        },
        GroupChat: true,
      },
    })
  }

  async fetchGroupChatMembers(
    groupChatId: number,
    memberIds: number[]
  ): Promise<TGroupChatMemberWithUser[]> {
    const members = await this.prismaService.groupChatMember.findMany({
      where: { groupChatId, userId: { in: memberIds } },
      include: {
        User: {
          include: { Profile: true },
        },
      },
    })
    return members
  }

  async searchGroupChatMembers(
    groupChatId: number,
    keyword: string
  ): Promise<TGroupChatMemberWithUser[]> {
    const members = await this.prismaService.groupChatMember.findMany({
      where: {
        groupChatId,
        OR: [
          { User: { Profile: { fullName: { contains: keyword, mode: 'insensitive' } } } },
          { User: { email: { contains: keyword, mode: 'insensitive' } } },
        ],
      },
      include: {
        User: { include: { Profile: true } },
      },
    })
    return members
  }

  async removeGroupChatMember(groupChatId: number, memberId: number): Promise<void> {
    const totalMembers = await this.prismaService.groupChatMember.count({
      where: { groupChatId },
    })
    if (totalMembers) {
      if (totalMembers < this.MIN_MEMBER_IN_GROUP_CHAT + 1) {
        throw new BadRequestException(EGroupMemberMessages.MIN_MEMBER_IN_GROUP_CHAT)
      }
    }
    try {
      await this.prismaService.groupChatMember.delete({
        where: { groupChatId_userId: { groupChatId, userId: memberId } },
      })
    } catch (error) {
      throw new InternalServerErrorException(EGroupMemberMessages.FAILED_TO_REMOVE_MEMBER)
    }
    const groupChat = await this.prismaService.groupChat.findUnique({
      where: { id: groupChatId },
    })
    if (groupChat) {
      this.userConnectionService.removeGroupChatMembers(groupChat, [memberId])
    }
  }

  async getGroupChatMember(groupChatId: number, userId: number): Promise<TGroupChatMember | null> {
    return await this.prismaService.groupChatMember.findFirst({
      where: { groupChatId, userId },
    })
  }

  async checkIfMembersInGroupChat(groupChatId: number, memberIds: number[]): Promise<boolean> {
    const groupChatMembers = await this.prismaService.groupChatMember.findMany({
      where: { groupChatId, userId: { in: memberIds } },
    })
    return groupChatMembers.length > 0
  }

  async addMembersToGroupChat(
    groupChatId: number,
    memberIds: number[],
    executor: TUserWithProfile
  ): Promise<TGroupChatMemberWithUser[]> {
    if (memberIds.length > this.MAX_ADD_MEMBER_AT_ONCE) {
      throw new BadRequestException(EGroupMemberMessages.MAX_ADD_MEMBER_AT_ONCE)
    }
    const totalMembers = await this.prismaService.groupChatMember.count({
      where: { groupChatId },
    })
    if (totalMembers + memberIds.length > this.MAX_ADD_MEMBER_TOTAL) {
      throw new BadRequestException(EGroupMemberMessages.MAX_ADD_MEMBER_TOTAL)
    }
    const isMembersInGroupChat = await this.checkIfMembersInGroupChat(groupChatId, memberIds)
    if (isMembersInGroupChat) {
      throw new BadRequestException(EGroupMemberMessages.MEMBERS_ALREADY_IN_GROUP_CHAT)
    }
    const groupChat = await this.prismaService.groupChat.update({
      where: { id: groupChatId },
      data: {
        Members: {
          create: memberIds.map((memberId) => ({ userId: memberId, joinedBy: executor.id })),
        },
      },
    })
    const addedMembers = await this.prismaService.groupChatMember.findMany({
      where: { groupChatId, userId: { in: memberIds } },
      include: { User: { include: { Profile: true } } },
    })
    this.userConnectionService.addMembersToGroupChat(groupChat, memberIds, executor)
    return addedMembers
  }

  async leaveGroupChat(groupChatId: number, userId: number): Promise<void> {
    // kiểm tra nếu là admin thì không được rời khỏi group chat
    const groupChat = await this.prismaService.groupChat.findFirst({
      where: { id: groupChatId, creatorId: userId },
      select: {
        id: true,
        creatorId: true,
      },
    })
    if (groupChat && groupChat.creatorId === userId)
      throw new BadRequestException(EGroupMemberMessages.ADMIN_CANNOT_LEAVE_GROUP_CHAT)
    await this.prismaService.groupChatMember.delete({
      where: { groupChatId_userId: { groupChatId, userId } },
    })
    this.userConnectionService.memberLeaveGroupChat(groupChatId, userId)
  }
}
