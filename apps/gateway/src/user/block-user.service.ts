import { BadRequestException, Injectable } from '@nestjs/common'

import { EProviderTokens } from '@/utils/enums'
import { PrismaService } from '@/configs/db/prisma.service'
import { Inject } from '@nestjs/common'
import type { TBlockedUser, TBlockedUserFullInfo } from '@/utils/entities/user.entity'
import { EUserMessages } from './user.message'

@Injectable()
export class BlockUserService {
  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService) {}

  async createBlockedUser(
    blockerUserId: number,
    blockedUserId: number
  ): Promise<TBlockedUserFullInfo> {
    return await this.prismaService.blockedUser.create({
      data: {
        blockerUserId: blockerUserId,
        blockedUserId: blockedUserId,
      },
      include: {
        UserBlocker: {
          include: {
            Profile: true,
          },
        },
        UserBlocked: {
          include: {
            Profile: true,
          },
        },
      },
    })
  }

  async findBlockedUser(userId: number, otherUserId: number): Promise<TBlockedUser | null> {
    return await this.prismaService.blockedUser.findFirst({
      where: {
        OR: [
          { blockerUserId: userId, blockedUserId: otherUserId },
          { blockerUserId: otherUserId, blockedUserId: userId },
        ],
      },
    })
  }

  async findBlockedUserWithFullInfo(
    userId: number,
    otherUserId: number
  ): Promise<TBlockedUserFullInfo | null> {
    return await this.prismaService.blockedUser.findFirst({
      where: {
        OR: [
          { blockerUserId: userId, blockedUserId: otherUserId },
          { blockerUserId: otherUserId, blockedUserId: userId },
        ],
      },
      include: {
        UserBlocker: {
          include: {
            Profile: true,
          },
        },
        UserBlocked: {
          include: {
            Profile: true,
          },
        },
      },
    })
  }

  async blockUser(blockerUserId: number, blockedUserId: number): Promise<void> {
    await this.createBlockedUser(blockerUserId, blockedUserId)
  }

  async checkBlockedUser(
    blockerId: number,
    blockedId: number
  ): Promise<TBlockedUserFullInfo | null> {
    return await this.findBlockedUserWithFullInfo(blockerId, blockedId)
  }

  async unblockUser(blockerId: number, otherUserId: number): Promise<void> {
    const blockedUser = await this.findBlockedUser(blockerId, otherUserId)
    if (!blockedUser) throw new BadRequestException(EUserMessages.USER_NOT_FOUND)
    if (blockedUser.blockerUserId !== blockerId)
      throw new BadRequestException(EUserMessages.YOU_ARE_NOT_BLOCKER)

    await this.prismaService.blockedUser.deleteMany({
      where: {
        blockerUserId: blockerId,
        blockedUserId: otherUserId,
      },
    })
  }

  async getBlockedUsersList(blockerUserId: number): Promise<TBlockedUserFullInfo[]> {
    return await this.prismaService.blockedUser.findMany({
      where: {
        blockerUserId,
      },
      include: {
        UserBlocked: {
          include: {
            Profile: true,
          },
        },
        UserBlocker: {
          include: {
            Profile: true,
          },
        },
      },
    })
  }
}
