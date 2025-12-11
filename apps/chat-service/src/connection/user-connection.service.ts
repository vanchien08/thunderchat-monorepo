import { Injectable } from '@nestjs/common'
import { Server } from 'socket.io'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import {
  EMessagingEmitSocketEvents,
  type IMessagingEmitSocketEvents,
} from '@/utils/events/socket.event'
import { EFriendRequestStatus } from '@/friend-request/friend-request.enum'
import type { TGetFriendRequestsData } from '@/friend-request/friend-request.type'
import type { TUserId } from '@/user/user.type'
import type { TServerMiddleware, TSocketId } from './user-connection.type'
import { DevLogger } from '@/dev/dev-logger'
import type { TMessageFullInfo } from '@/utils/entities/message.entity'
import type { TGroupChat } from '@/utils/entities/group-chat.entity'
import type { TDirectChat } from '@/utils/entities/direct-chat.entity'
import { EChatType, EUserOnlineStatus } from '@/utils/enums'
import { createDirectChatRoomName, createGroupChatRoomName } from '@/utils/helpers'
import { UpdateProfileDto } from '@/profile/profile.dto'
import type { TClientSocket } from '@/utils/events/event.type'

@Injectable()
export class UserConnectionService {
  private messagingServer: Server<{}, IMessagingEmitSocketEvents>
  private readonly connectedClients = new Map<TUserId, TClientSocket[]>()
  private readonly userChattingConnections = new Map<TUserId, TDirectChat['id'][]>()

  setMessagingServer(server: Server): void {
    this.messagingServer = server
  }

  getMessagingServer(): Server {
    return this.messagingServer
  }

  setMessagingServerMiddleware(middleware: TServerMiddleware): void {
    this.messagingServer.use(middleware)
  }

  addConnectedClient(userId: TUserId, client: TClientSocket): void {
    const currentClients = this.getConnectedClient(userId)
    if (currentClients && currentClients.length > 0) {
      currentClients.push(client)
    } else {
      this.connectedClients.set(userId, [client])
    }
  }

  getConnectedClient(clientId: TUserId): TClientSocket[] | null {
    return this.connectedClients.get(clientId) || null
  }

  checkUserIsConnected(userId: TUserId): boolean {
    return (this.connectedClients.get(userId)?.length || 0) > 0
  }

  removeConnectedClient(userId: TUserId, socketId?: TSocketId): void {
    if (socketId) {
      const userSockets = this.getConnectedClient(userId)
      if (userSockets && userSockets.length > 0) {
        this.connectedClients.set(
          userId,
          userSockets.filter((socket) => socket.id !== socketId)
        )
      }
    } else {
      this.connectedClients.delete(userId)
    }
  }

  printOutSession() {
    for (const [key, value] of this.connectedClients) {
      for (const client of value) {
        DevLogger.logInfo(`key: ${key} - something: ${client.handshake?.auth.clientId}`)
      }
    }
  }

  sendFriendRequest(
    sender: TUserWithProfile,
    recipientId: TUserId,
    requestData: TGetFriendRequestsData
  ): void {
    const recipientSockets = this.getConnectedClient(recipientId)
    if (recipientSockets && recipientSockets.length > 0) {
      for (const socket of recipientSockets) {
        socket.emit(EMessagingEmitSocketEvents.send_friend_request, sender, requestData)
      }
    }
  }

  friendRequestAction(senderId: number, requestId: number, action: EFriendRequestStatus): void {
    const senderSockets = this.getConnectedClient(senderId)
    if (senderSockets && senderSockets.length > 0) {
      for (const socket of senderSockets) {
        socket.emit(EMessagingEmitSocketEvents.friend_request_action, {
          requestId,
          action,
        })
      }
    }
  }

  getConnectedClientsCountForAdmin(): number {
    // hàm chỉ dùng cho admin
    const connectedClients = this.connectedClients
    let count = 0
    for (const [_, value] of connectedClients) {
      if (value && value.length > 0) {
        count += 1
      }
    }
    return count
  }

  async emitToDirectChat(directChatId: number, event: EMessagingEmitSocketEvents, payload: any) {
    if (this.messagingServer) {
      const room = createDirectChatRoomName(directChatId)
      this.messagingServer.to(room).emit(event, payload)
    }
  }

  getUserOnlineStatus(userId: TUserId): EUserOnlineStatus {
    const userSockets = this.getConnectedClient(userId)
    return !!userSockets && userSockets.length > 0
      ? EUserOnlineStatus.ONLINE
      : EUserOnlineStatus.OFFLINE
  }

  checkUserIsOnline(userId: TUserId): boolean {
    return this.getUserOnlineStatus(userId) === EUserOnlineStatus.ONLINE
  }

  emitToUser(userId: TUserId, event: EMessagingEmitSocketEvents, payload: any): void {
    const userSockets = this.getConnectedClient(userId)
    if (userSockets && userSockets.length > 0) {
      for (const socket of userSockets) {
        socket.emit(event, payload)
      }
    }
  }

  sendNewMessageToRecipient(
    recipientId: TUserId,
    newMessage: TMessageFullInfo,
    isNewDirectChat: boolean,
    directChat: TDirectChat,
    sender: TUserWithProfile
  ) {
    const recipientSockets = this.getConnectedClient(recipientId)
    if (recipientSockets && recipientSockets.length > 0) {
      for (const socket of recipientSockets) {
        socket.emit(EMessagingEmitSocketEvents.send_message_direct, newMessage)
        if (isNewDirectChat) {
          socket.emit(
            EMessagingEmitSocketEvents.new_conversation,
            directChat,
            null,
            EChatType.DIRECT,
            newMessage,
            sender
          )
        }
      }
    }
  }

  sendNewMessageToGroupChat(groupChatId: TGroupChat['id'], newMessage: TMessageFullInfo) {
    this.messagingServer
      .to(createGroupChatRoomName(groupChatId))
      .emit(EMessagingEmitSocketEvents.send_message_group, newMessage)
  }

  broadcastCreateGroupChat(
    groupChat: TGroupChat,
    groupMemberIds: number[],
    creator: TUserWithProfile
  ) {
    for (const groupMemberId of groupMemberIds) {
      const groupMemberSockets = this.getConnectedClient(groupMemberId)
      if (groupMemberSockets && groupMemberSockets.length > 0) {
        for (const socket of groupMemberSockets) {
          socket.emit(
            EMessagingEmitSocketEvents.new_conversation,
            null,
            groupChat,
            EChatType.GROUP,
            null,
            creator
          )
        }
      }
    }
  }

  broadcastUserOnlineStatus(userId: TUserId, onlineStatus: EUserOnlineStatus) {
    this.messagingServer.emit(
      EMessagingEmitSocketEvents.broadcast_user_online_status,
      userId,
      onlineStatus
    )
  }

  broadcastAddMembersToGroupChat(
    groupChat: TGroupChat,
    groupMemberIds: number[],
    executor: TUserWithProfile
  ) {
    for (const groupMemberId of groupMemberIds) {
      const groupMemberSockets = this.getConnectedClient(groupMemberId)
      if (groupMemberSockets) {
        for (const socket of groupMemberSockets) {
          socket.emit(
            EMessagingEmitSocketEvents.new_conversation,
            null,
            groupChat,
            EChatType.GROUP,
            null,
            executor
          )
        }
      }
    }
    this.messagingServer
      .to(createGroupChatRoomName(groupChat.id))
      .emit(EMessagingEmitSocketEvents.add_group_chat_members, groupMemberIds, groupChat)
  }

  broadcastRemoveGroupChatMembers(groupChat: TGroupChat, groupMemberIds: number[]) {
    this.messagingServer
      .to(createGroupChatRoomName(groupChat.id))
      .emit(EMessagingEmitSocketEvents.remove_group_chat_members, groupMemberIds, groupChat)
  }

  broadcastUpdateGroupChat(groupChatId: number, groupChat: Partial<TGroupChat>) {
    this.messagingServer
      .to(createGroupChatRoomName(groupChatId))
      .emit(EMessagingEmitSocketEvents.update_group_chat_info, groupChatId, groupChat)
  }

  broadcastUpdateUserInfo(updatedUserId: TUserId, updates: UpdateProfileDto) {
    const directChatIds = this.getUserChattingConnection(updatedUserId)
    if (directChatIds) {
      for (const directChatId of directChatIds) {
        this.messagingServer
          .to(createDirectChatRoomName(directChatId))
          .emit(EMessagingEmitSocketEvents.update_user_info, directChatId, updatedUserId, updates)
      }
    }
  }

  broadcastDeleteDirectChat(directChatId: number, deleter: TUserWithProfile) {
    this.messagingServer
      .to(createDirectChatRoomName(directChatId))
      .emit(EMessagingEmitSocketEvents.delete_direct_chat, directChatId, deleter)
  }

  broadcastDeleteGroupChat(groupChatId: number) {
    this.messagingServer
      .to(createGroupChatRoomName(groupChatId))
      .emit(EMessagingEmitSocketEvents.delete_group_chat, groupChatId)
  }

  broadcastMemberLeaveGroupChat(groupChatId: number, userId: number) {
    this.messagingServer
      .to(createGroupChatRoomName(groupChatId))
      .emit(EMessagingEmitSocketEvents.member_leave_group_chat, groupChatId, userId)
  }

  setUserChattingConnection(
    userId: TUserId,
    otherUserId: TUserId,
    directChatId: TDirectChat['id']
  ): void {
    const userConnections = this.userChattingConnections.get(userId)
    if (userConnections) {
      if (!userConnections.includes(directChatId)) userConnections.push(directChatId)
    } else {
      this.userChattingConnections.set(userId, [directChatId])
    }
    const otherUserConnections = this.userChattingConnections.get(otherUserId)
    if (otherUserConnections) {
      if (!otherUserConnections.includes(directChatId)) otherUserConnections.push(directChatId)
    } else {
      this.userChattingConnections.set(otherUserId, [directChatId])
    }
  }

  getUserChattingConnection(userId: TUserId): TDirectChat['id'][] | undefined {
    return this.userChattingConnections.get(userId)
  }

  removeChattingConnection(userId?: TUserId, recipientId?: TUserId): void {
    if (userId) {
      this.userChattingConnections.delete(userId)
    }
    if (recipientId) {
      this.userChattingConnections.delete(recipientId)
    }
  }
}
