import type { TSuccess } from '@/utils/types'
import type { GetFriendsByKeywordDTO, GetFriendsDTO, RemoveFriendDTO } from './friend.dto'
import type { TGetFriendsData } from './friend.type'
import type { TUserWithProfile } from '@/utils/entities/user.entity'

export interface IFriendController {
  getFriends: (getFriendsPayload: GetFriendsDTO) => Promise<TGetFriendsData[]>
  getFriendsByKeyword: (
    payload: GetFriendsByKeywordDTO,
    user: TUserWithProfile
  ) => Promise<TGetFriendsData[]>
  removeFriend: (payload: RemoveFriendDTO, user: TUserWithProfile) => Promise<TSuccess>
}

export interface IFriendGrpcController {
  ValidateSocketAuth: (userId: number, friendId: number) => Promise<Boolean>
}
