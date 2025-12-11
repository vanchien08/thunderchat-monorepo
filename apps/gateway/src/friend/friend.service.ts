import type { TFriendRequest } from '@/utils/entities/friend.entity'
import { EProviderTokens } from '@/utils/enums'
import { PrismaService } from '@/configs/db/prisma.service'
import type { TSignatureObject } from '@/utils/types'
import { Inject, Injectable } from '@nestjs/common'
import { GetFriendsDTO } from './friend.dto'
import type { TGetFriendsData } from './friend.type'
// import { countMutualFriends } from '@prisma/client/sql'

@Injectable()
export class FriendService {
  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private PrismaService: PrismaService) {}

  async findByIds(userId: number, friendId: number): Promise<TFriendRequest | null> {
    return await this.PrismaService.friendRequest.findFirst({
      where: {
        OR: [
          { senderId: userId, recipientId: friendId },
          { senderId: friendId, recipientId: userId },
        ],
      },
    })
  }

  // /**
  //  * Count how many mutual friends the user have with a friend
  //  * @param userId who is "the user" want to check number of mutual friends
  //  * @param friendId who is "the opponent" for "the user" to check
  //  * @returns number of mutual friends between "the user" and "the opponent"
  //  */
  // async countMutualFriend(userId: number, friendId: number): Promise<number> {
  //   const res = await this.PrismaService.$queryRawTyped(countMutualFriends(userId, friendId))
  //   return Number(res[0].mutualFriends)
  // }

  async isFriend(userId: number, friendId: number): Promise<boolean> {
    return !!(await this.findByIds(userId, friendId))
  }

  async getFriends(getFriendsPayload: GetFriendsDTO): Promise<TGetFriendsData[]> {
    const { limit, userId, lastFriendId, search } = getFriendsPayload
    let cursor: TSignatureObject = {}
    if (lastFriendId) {
      cursor = {
        skip: 1,
        cursor: {
          id: lastFriendId,
        },
      }
    }
    // Nếu có search thì tìm kiếm theo tên bạn bè (Profile.fullName)
    if (search) {
      return await this.PrismaService.friend.findMany({
        take: limit,
        ...cursor,
        where: {
          OR: [
            {
              recipientId: userId,
              Sender: {
                Profile: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
            },
            {
              senderId: userId,
              Recipient: {
                Profile: {
                  fullName: { contains: search, mode: 'insensitive' },
                },
              },
            },
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        select: {
          id: true,
          senderId: true,
          Recipient: { include: { Profile: true } },
          Sender: { include: { Profile: true } },
          createdAt: true,
        },
      })
    }
    // Nếu không có search thì lấy theo phân trang bình thường
    return await this.PrismaService.friend.findMany({
      take: limit,
      ...cursor,
      where: {
        OR: [{ recipientId: userId }, { senderId: userId }],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        senderId: true,
        Recipient: { include: { Profile: true } },
        Sender: { include: { Profile: true } },
        createdAt: true,
      },
    })
  }

  async getFriendsByKeyword(keyword: string, userId: number): Promise<TGetFriendsData[]> {
    return await this.PrismaService.friend.findMany({
      where: {
        OR: [
          {
            senderId: userId,
            Recipient: {
              OR: [
                { Profile: { fullName: { contains: keyword, mode: 'insensitive' } } },
                { email: { equals: keyword, mode: 'insensitive' } },
              ],
            },
          },
          {
            recipientId: userId,
            Sender: {
              OR: [
                { Profile: { fullName: { contains: keyword, mode: 'insensitive' } } },
                { email: { equals: keyword, mode: 'insensitive' } },
              ],
            },
          },
        ],
      },
      select: {
        id: true,
        senderId: true,
        Recipient: { include: { Profile: true } },
        Sender: { include: { Profile: true } },
        createdAt: true,
      },
    })
  }

  async removeFriend(userId: number, friendId: number): Promise<void> {
    await this.PrismaService.friend.deleteMany({
      where: {
        OR: [
          { senderId: userId, recipientId: friendId },
          { senderId: friendId, recipientId: userId },
        ],
      },
    })
    await this.PrismaService.friendRequest.deleteMany({
      where: {
        OR: [
          { senderId: userId, recipientId: friendId },
          { senderId: friendId, recipientId: userId },
        ],
      },
    })
  }
}
