import { PrismaService } from '@/configs/db/prisma.service'
import type { TFriendRequest } from '@/utils/entities/friend.entity'
import { EProviderTokens } from '@/utils/enums'
import { BadRequestException, Inject, Injectable } from '@nestjs/common'
import { EFriendRequestMessages } from './friend-request.message'
import { UserService } from '@/user/user.service'
import { UserConnectionService } from '@/connection/user-connection.service'
import { EFriendRequestStatus } from './friend-request.enum'
import { FriendRequestActionDTO, GetFriendRequestsDTO } from './friend-request.dto'
import { TGetFriendRequestsData } from './friend-request.type'
import type { TDiscriminatedQueryReturn, TSignatureObject } from '@/utils/types'
import { Prisma } from '@prisma/client'
import { BlockUserService } from '@/user/block-user.service'
import { EUserMessages } from '@/user/user.message'

@Injectable()
export class FriendRequestService {
  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private PrismaService: PrismaService,
    private userService: UserService,
    private userConnectionService: UserConnectionService,
    private blockUserService: BlockUserService
  ) {}

  async create<R extends TFriendRequest>(
    senderId: number,
    recipientId: number,
    returnType?: TDiscriminatedQueryReturn<
      Prisma.FriendRequestSelect,
      Prisma.FriendRequestInclude,
      Prisma.FriendRequestOmit
    >
  ): Promise<R> {
    return (await this.PrismaService.friendRequest.create({
      data: {
        status: 'PENDING',
        recipientId,
        senderId,
      },
      ...(returnType ? { ...returnType } : {}),
    })) as R
  }

  async update<R>(
    requestId: number,
    senderId: number,
    recipientId: number,
    status: EFriendRequestStatus,
    returnType?: TDiscriminatedQueryReturn<
      Prisma.FriendRequestSelect,
      Prisma.FriendRequestInclude,
      Prisma.FriendRequestOmit
    >
  ): Promise<R> {
    return (await this.PrismaService.friendRequest.update({
      where: {
        id: requestId,
      },
      data: {
        status,
        senderId,
        recipientId,
        updatedAt: new Date(),
      },
      ...(returnType ? { ...returnType } : {}),
    })) as R
  }

  async findFriendRequest(senderId: number, recipientId: number): Promise<TFriendRequest | null> {
    return await this.PrismaService.friendRequest.findFirst({ where: { senderId, recipientId } })
  }

  async findSentFriendRequest(
    senderId: number,
    recipientId: number
  ): Promise<TFriendRequest | null> {
    const relatedUsers = [senderId, recipientId]
    return await this.PrismaService.friendRequest.findFirst({
      where: {
        senderId: { in: relatedUsers },
        recipientId: { in: relatedUsers },
      },
    })
  }

  private async checkBlockedUser(senderId: number, recipientId: number): Promise<void> {
    const blockedUser = await this.blockUserService.checkBlockedUser(senderId, recipientId)
    if (blockedUser?.blockedUserId === senderId) {
      throw new BadRequestException(EUserMessages.YOU_ARE_BLOCKED_BY_THIS_USER)
    }
    if (blockedUser?.blockerUserId === senderId) {
      throw new BadRequestException(EUserMessages.YOU_HAVE_BLOCKED_THIS_USER)
    }
  }

  async sendFriendRequest(senderId: number, recipientId: number): Promise<TGetFriendRequestsData> {
    if (senderId === recipientId) {
      throw new BadRequestException(EFriendRequestMessages.SEND_TO_MYSELF)
    }
    await this.checkBlockedUser(senderId, recipientId)
    const existing = await this.findSentFriendRequest(senderId, recipientId)
    let friendRequest: TGetFriendRequestsData | null = null
    if (existing) {
      if (
        existing.status === EFriendRequestStatus.PENDING ||
        existing.status === EFriendRequestStatus.ACCEPTED
      ) {
        throw new BadRequestException(EFriendRequestMessages.INVITATION_SENT_BEFORE)
      }
      friendRequest = await this.update(
        existing.id,
        senderId,
        recipientId,
        EFriendRequestStatus.PENDING,
        {
          include: {
            Sender: {
              include: {
                Profile: true,
              },
            },
            Recipient: {
              include: {
                Profile: true,
              },
            },
          },
        }
      )
    } else {
      friendRequest = await this.create<TGetFriendRequestsData>(senderId, recipientId, {
        include: {
          Sender: {
            include: {
              Profile: true,
            },
          },
          Recipient: {
            include: {
              Profile: true,
            },
          },
        },
      })
    }
    if (!friendRequest) {
      throw new BadRequestException(EFriendRequestMessages.FRIEND_REQUEST_NOT_FOUND)
    }
    const sender = await this.userService.findUserWithProfileById(senderId)
    if (!sender) {
      throw new BadRequestException(EFriendRequestMessages.SENDER_NOT_FOUND)
    }
    this.userConnectionService.sendFriendRequest(sender, recipientId, friendRequest)
    return friendRequest
  }

  async friendRequestAction(friendRequestPayload: FriendRequestActionDTO): Promise<void> {
    const { requestId, action, senderId } = friendRequestPayload
    switch (action) {
      case EFriendRequestStatus.ACCEPTED:
        await this.PrismaService.$transaction(async (tx) => {
          const friendRequest = await this.PrismaService.friendRequest.update({
            where: {
              id: requestId,
            },
            data: {
              status: EFriendRequestStatus.ACCEPTED,
            },
          })
          await this.PrismaService.friend.create({
            data: {
              recipientId: friendRequest.recipientId,
              senderId: friendRequest.senderId,
            },
          })
        })
        break
      case EFriendRequestStatus.REJECTED:
        await this.PrismaService.friendRequest.update({
          where: {
            id: requestId,
          },
          data: {
            status: EFriendRequestStatus.REJECTED,
          },
        })
        break
    }
    this.userConnectionService.friendRequestAction(senderId, requestId, action)
  }

  async getFriendRequests(
    getFriendRequestsPayload: GetFriendRequestsDTO
  ): Promise<TGetFriendRequestsData[]> {
    const { lastFriendRequestId, limit, userId } = getFriendRequestsPayload
    let cursor: TSignatureObject = {}
    if (lastFriendRequestId) {
      cursor = {
        skip: 1,
        cursor: {
          id: lastFriendRequestId,
        },
      }
    }
    return await this.PrismaService.friendRequest.findMany({
      take: limit,
      ...cursor,
      where: {
        OR: [{ recipientId: userId }, { senderId: userId }],
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
      include: {
        Sender: {
          include: {
            Profile: true,
          },
        },
        Recipient: {
          include: {
            Profile: true,
          },
        },
      },
    })
  }
}
