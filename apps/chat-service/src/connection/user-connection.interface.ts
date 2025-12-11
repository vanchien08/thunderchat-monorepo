import type {
  TCheckUserIsOnlineRequest,
  TEmitToDirectChatPayload,
  TFriendRequestActionPayload,
  TGetConnectedClientsCountForAdminResponse,
  TRemoveConnectedClientRequest,
  TSendFriendRequestPayload,
  TSendNewMessageToGroupChatPayload,
} from './user-connection.type'
import type { CheckUserIsOnlineResponse } from 'protos/generated/chat'

export interface IUserConnectionGrpcController {
  sendFriendRequest(data: TSendFriendRequestPayload): Promise<void>
  removeConnectedClient(data: TRemoveConnectedClientRequest): Promise<void>
  checkUserIsOnline(data: TCheckUserIsOnlineRequest): Promise<CheckUserIsOnlineResponse>
  friendRequestAction(data: TFriendRequestActionPayload): Promise<void>
  getConnectedClientsCountForAdmin(): Promise<TGetConnectedClientsCountForAdminResponse>
  emitToDirectChat(data: TEmitToDirectChatPayload): Promise<void>
  sendNewMessageToGroupChat(data: TSendNewMessageToGroupChatPayload): Promise<void>
}
