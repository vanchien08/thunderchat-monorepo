import type {
   FriendRequestActionDTO,
   GetFriendRequestsDTO,
   SendFriendRequestDTO,
} from './friend-request.dto'
import type { TSuccess } from '@/utils/types'
import type { EFriendRequestStatus } from './friend-request.enum'
import type { TGetFriendRequestsData } from './friend-request.type'
import type { TFriendRequest } from '@/utils/entities/friend.entity'

export interface IFriendRequestController {
   sendFriendRequest: (sendFriendRequestPayload: SendFriendRequestDTO) => Promise<TFriendRequest>
   friendRequestAction: (
      friendRequestActionPayload: FriendRequestActionDTO,
      action: EFriendRequestStatus
   ) => Promise<TSuccess>
   getFriendRequests: (
      getFriendRequestsPayload: GetFriendRequestsDTO
   ) => Promise<TGetFriendRequestsData[]>
}
