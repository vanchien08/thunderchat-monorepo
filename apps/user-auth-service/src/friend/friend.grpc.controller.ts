import { Controller, Get, Query } from '@nestjs/common'

import { GrpcMethod } from '@nestjs/microservices'

import { FriendService } from './friend.service'

@Controller()
export class FriendGrpcController {
  constructor(private readonly friendService: FriendService) {}

  @GrpcMethod('FriendService', 'IsFriend')
  async IsFriend(data: { userId: number; friendId: number }) {
    const isFriend = await this.friendService.isFriend(data.userId, data.friendId)
    return { isFriend }
  }
}
