import { EGrpcServices } from '@/utils/enums'
import { Controller } from '@nestjs/common'
import { GrpcMethod } from '@nestjs/microservices'
import type {
  TCheckUserIsOnlineRequest,
  TEmitToDirectChatPayload,
  TFriendRequestActionPayload,
  TRemoveConnectedClientRequest,
  TSendFriendRequestPayload,
  TSendNewMessageToGroupChatPayload,
  TUpdateGroupChatInfoPayload,
  TCreateGroupChatPayload,
  TAddMembersToGroupChatPayload,
  TRemoveGroupChatMembersPayload,
  TDeleteGroupChatPayload,
  TMemberLeaveGroupChatPayload,
  TUpdateUserInfoPayload,
} from './user-connection.type'
import type { IUserConnectionGrpcController } from './user-connection.interface'
import { UserConnectionService } from './user-connection.service'
import { EFriendRequestStatus } from '@/friend-request/friend-request.enum'
import { EMessagingEmitSocketEvents } from '@/utils/events/socket.event'

@Controller()
export class UserConnectionGrpcController implements IUserConnectionGrpcController {
  constructor(private userConnectionService: UserConnectionService) {}

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'SendFriendRequest')
  async sendFriendRequest(data: TSendFriendRequestPayload) {
    this.userConnectionService.sendFriendRequest(
      JSON.parse(data.senderJson),
      data.recipientId,
      JSON.parse(data.requestDataJson)
    )
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'RemoveConnectedClient')
  async removeConnectedClient(data: TRemoveConnectedClientRequest) {
    this.userConnectionService.removeConnectedClient(data.userId, data.socketId)
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'CheckUserIsOnline')
  async checkUserIsOnline(data: TCheckUserIsOnlineRequest) {
    const isOnline = this.userConnectionService.checkUserIsOnline(data.userId)
    return { isOnline }
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'FriendRequestAction')
  async friendRequestAction(data: TFriendRequestActionPayload) {
    this.userConnectionService.friendRequestAction(
      data.senderId,
      data.requestId,
      data.action as EFriendRequestStatus
    )
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'GetConnectedClientsCountForAdmin')
  async getConnectedClientsCountForAdmin() {
    const count = this.userConnectionService.getConnectedClientsCountForAdmin()
    return { count }
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'EmitToDirectChat')
  async emitToDirectChat(data: TEmitToDirectChatPayload) {
    await this.userConnectionService.emitToDirectChat(
      data.directChatId,
      data.event as EMessagingEmitSocketEvents,
      data.payloadJson ? JSON.parse(data.payloadJson) : null
    )
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'SendNewMessageToGroupChat')
  async sendNewMessageToGroupChat(data: TSendNewMessageToGroupChatPayload) {
    this.userConnectionService.sendNewMessageToGroupChat(
      data.groupChatId,
      JSON.parse(data.newMessageJson)
    )
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'UpdateGroupChatInfo')
  async updateGroupChatInfo(data: TUpdateGroupChatInfoPayload) {
    this.userConnectionService.broadcastUpdateGroupChat(data.groupChatId, {
      name: data.groupName || undefined,
      avatarUrl: data.groupAvatarUrl || undefined,
    })
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'CreateGroupChat')
  async createGroupChat(data: TCreateGroupChatPayload) {
    this.userConnectionService.broadcastCreateGroupChat(
      JSON.parse(data.groupChatJson),
      data.memberIds,
      JSON.parse(data.creatorJson)
    )
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'AddMembersToGroupChat')
  async addMembersToGroupChat(data: TAddMembersToGroupChatPayload) {
    this.userConnectionService.broadcastAddMembersToGroupChat(
      JSON.parse(data.groupChatJson),
      data.memberIds,
      JSON.parse(data.executorJson)
    )
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'RemoveGroupChatMembers')
  async removeGroupChatMembers(data: TRemoveGroupChatMembersPayload) {
    this.userConnectionService.broadcastRemoveGroupChatMembers(
      JSON.parse(data.groupChatJson),
      data.memberIds
    )
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'DeleteGroupChat')
  async deleteGroupChat(data: TDeleteGroupChatPayload) {
    this.userConnectionService.broadcastDeleteGroupChat(data.groupChatId)
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'MemberLeaveGroupChat')
  async memberLeaveGroupChat(data: TMemberLeaveGroupChatPayload) {
    this.userConnectionService.broadcastMemberLeaveGroupChat(data.groupChatId, data.userId)
  }

  @GrpcMethod(EGrpcServices.USER_CONNECTION_SERVICE, 'UpdateUserInfo')
  async updateUserInfo(data: TUpdateUserInfoPayload) {
    this.userConnectionService.broadcastUpdateUserInfo(data.userId, JSON.parse(data.updatesJson))
  }
}
