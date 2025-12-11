import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets'
import type { OnGatewayConnection, OnGatewayInit, OnGatewayDisconnect } from '@nestjs/websockets'
import { Server } from 'socket.io'
import {
  EMessagingEmitSocketEvents,
  EMessagingListenSocketEvents,
} from '../utils/events/socket.event'
import { EMessageTypeAllTypes, ESocketNamespaces } from './messaging.enum'
import {
  UseFilters,
  UsePipes,
  UseInterceptors,
  ForbiddenException,
  BadGatewayException,
  Inject,
} from '@nestjs/common'
import { BaseWsException } from '../utils/exceptions/base-ws.exception'
import {
  CatchInternalSocketError,
  BaseWsExceptionsFilter,
} from '@/utils/exception-filters/base-ws-exception.filter'
import type {
  TCheckCanSendMessageInGroupChat,
  TFindDirectChatWithOtherUser,
  THandleEmitNewMessageParams,
  THandleMessageParamsClient,
  THandleMessageParamsMessage,
} from './messaging.type'
import type { TClientSocket } from '@/utils/events/event.type'
import type { IMessagingGateway } from './messaging.interface'
import { UserConnectionService } from '../connection/user-connection.service'
import {
  MarkAsSeenDTO,
  TypingDTO,
  SendDirectMessageDTO,
  JoinGroupChatDTO,
  SendGroupMessageDTO,
  CheckUserOnlineDTO,
  JoinDirectChatDTO,
} from './messaging.dto'
import type { TMessageOffset } from '@/message/message.type'
import { EMsgMessages } from '@/message/message.message'
import { MessageTokensManager } from '@/messaging/helpers/message-tokens.helper'
import { EMessageStatus, EMessageTypes } from '@/message/message.enum'
import { ConversationTypingManager } from './helpers/conversation-typing.helper'
import { DevLogger } from '@/dev/dev-logger'
import { Socket } from 'socket.io'
import type { TMessageFullInfo, TMessageWithAuthor } from '@/utils/entities/message.entity'
import {
  EChatType,
  EGrpcPackages,
  EGrpcServices,
  EInternalEvents,
  EUserOnlineStatus,
} from '@/utils/enums'
import { EGatewayMessages } from './messaging.message'
import { MessagingGatewayInterceptor } from './messaging.interceptor'
import type { TGroupChat } from '@/utils/entities/group-chat.entity'
import type { TUserWithProfile } from '@/utils/entities/user.entity'
import { OnEvent } from '@nestjs/event-emitter'
import { createDirectChatRoomName, createGroupChatRoomName } from '@/utils/helpers'
import { EUserSettingsMessages } from '@/user/user-settings/user-settings.message'
import { EUserMessages } from '@/user/user.message'
import { EGroupMemberMessages } from '@/group-member/group-member.message'
import { EGroupChatPermissions, EGroupChatRoles } from '@/group-chat/group-chat.enum'
import type { TUserId } from '@/user/user.type'
import { UpdateProfileDto } from '@/profile/profile.dto'
import { gatewayValidationPipe } from '@/utils/validation/gateway.validation'
import { ClientGrpc } from '@nestjs/microservices/interfaces/client-grpc.interface'
import { DirectChatService } from '@/configs/communication/grpc/services/direct-chat.service'
import { AuthService } from '@/configs/communication/grpc/services/auth.service'
import { MessageService } from '@/configs/communication/grpc/services/message.service'
import { PushNotificationService } from '@/configs/communication/grpc/services/notification.service'
import { GroupChatService } from '@/configs/communication/grpc/services/group-chat.service'
import { GroupMemberService } from '@/configs/communication/grpc/services/group-member.service'
import { UserService } from '@/configs/communication/grpc/services/user.service'
import { UserSettingsService } from '@/configs/communication/grpc/services/user-settings.service'
import { BlockUserService } from '@/configs/communication/grpc/services/block-user.service'
import { FriendService } from '@/configs/communication/grpc/services/friend.service'
import { SmartSearchService } from '@/configs/communication/grpc/services/smart-search.service'

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: ESocketNamespaces.messaging,
})
@UseFilters(new BaseWsExceptionsFilter())
@UsePipes(gatewayValidationPipe)
@UseInterceptors(MessagingGatewayInterceptor)
export class MessagingGateway
  implements
    OnGatewayConnection<TClientSocket>,
    OnGatewayDisconnect<TClientSocket>,
    OnGatewayInit<Server>,
    IMessagingGateway
{
  private readonly messageTokensManager = new MessageTokensManager()
  private readonly convTypingManager = new ConversationTypingManager()
  private friendService: FriendService
  private messageService: MessageService
  private authService: AuthService
  private directChatService: DirectChatService
  private userService: UserService
  private groupChatService: GroupChatService
  private groupMemberService: GroupMemberService
  private userSettingsService: UserSettingsService
  private blockUserService: BlockUserService
  private pushNotificationService: PushNotificationService
  private smartSearch: SmartSearchService
  constructor(
    private userConnectionService: UserConnectionService,
    @Inject(EGrpcPackages.FRIEND_PACKAGE) private friendClient: ClientGrpc,
    @Inject(EGrpcPackages.CONVERSATION_PACKAGE) private messageClient: ClientGrpc,
    @Inject(EGrpcPackages.AUTH_PACKAGE) private authClient: ClientGrpc,
    @Inject(EGrpcPackages.CONVERSATION_PACKAGE) private directChatClient: ClientGrpc,
    @Inject(EGrpcPackages.USER_PACKAGE) private userClient: ClientGrpc,
    @Inject(EGrpcPackages.CONVERSATION_PACKAGE) private groupChatClient: ClientGrpc,
    @Inject(EGrpcPackages.CONVERSATION_PACKAGE) private groupMemberClient: ClientGrpc,
    @Inject(EGrpcPackages.USER_PACKAGE) private userSettingsClient: ClientGrpc,
    @Inject(EGrpcPackages.USER_PACKAGE) private blockUserClient: ClientGrpc,
    @Inject(EGrpcPackages.NOTIFICATION_PACKAGE) private pushNotificationClient: ClientGrpc,
    @Inject(EGrpcPackages.SEARCH_PACKAGE) private AIClient: ClientGrpc
  ) {
    // Initialize all gRPC services
    this.friendService = new FriendService(
      this.friendClient.getService(EGrpcServices.FRIEND_SERVICE)
    )
    this.messageService = new MessageService(
      this.messageClient.getService(EGrpcServices.MESSAGE_SERVICE)
    )
    this.authService = new AuthService(this.authClient.getService(EGrpcServices.AUTH_SERVICE))
    this.directChatService = new DirectChatService(
      this.directChatClient.getService(EGrpcServices.DIRECT_CHAT_SERVICE)
    )
    this.userService = new UserService(this.userClient.getService(EGrpcServices.USER_SERVICE))
    this.groupChatService = new GroupChatService(
      this.groupChatClient.getService(EGrpcServices.GROUP_CHAT_SERVICE)
    )
    this.groupMemberService = new GroupMemberService(
      this.groupMemberClient.getService(EGrpcServices.GROUP_MEMBER_SERVICE)
    )
    this.userSettingsService = new UserSettingsService(
      this.userSettingsClient.getService(EGrpcServices.USER_SETTINGS_SERVICE)
    )
    this.blockUserService = new BlockUserService(
      this.blockUserClient.getService(EGrpcServices.BLOCK_USER_SERVICE)
    )
    this.pushNotificationService = new PushNotificationService(
      this.pushNotificationClient.getService(EGrpcServices.NOTIFICATION_SERVICE)
    )

    this.smartSearch = new SmartSearchService(this.AIClient.getService(EGrpcServices.AI_SERVICE))
  }

  /**
   * This function is called (called one time) when the server is initialized.
   * It sets the server and the server middleware.
   * The server middleware is used to validate the socket connection.
   * @param server - The server instance.
   */
  async afterInit(server: Server): Promise<void> {
    this.userConnectionService.setMessagingServer(server)
    this.userConnectionService.setMessagingServerMiddleware(async (socket, next) => {
      try {
        await this.authService.validateSocketConnection(socket)
      } catch (error) {
        console.error('>>> error at afterInit:', error)
        DevLogger.logForWebsocket('error at validate socket connection 173:', error)
        next(error)
        return
      }
      next()
    })
  }

  /**
   * This function is called when a client connects to the server.
   * It validates the socket connection and adds the client to the connected clients list.
   * @param client - The client instance.
   */
  async handleConnection(client: TClientSocket): Promise<void> {
    DevLogger.logForWebsocket('connected socket:', {
      socketId: client.id,
      auth: client.handshake.auth,
    })
    try {
      const { clientId, messageOffset, directChatId, groupId } =
        await this.authService.validateSocketAuth(client)
      this.userConnectionService.addConnectedClient(clientId, client)
      this.userConnectionService.broadcastUserOnlineStatus(clientId, EUserOnlineStatus.ONLINE)
      client.emit(EMessagingEmitSocketEvents.server_hello, 'You connected sucessfully!')
      if (messageOffset) {
        await this.recoverMissingMessages(client, messageOffset, directChatId, groupId)
      }
    } catch (error) {
      console.error('>>> error at handleConnection:', error)
      DevLogger.logForWebsocket('error at handleConnection:', error)
      client.disconnect(true)
    }
  }

  /**
   * This function is called when a client disconnects from the server.
   * It removes the client from the connected clients list and the message tokens.
   * @param client - The client instance.
   */
  async handleDisconnect(client: TClientSocket): Promise<void> {
    DevLogger.logForWebsocket('disconnected socket:', {
      socketId: client.id,
      auth: client.handshake.auth,
    })
    const { clientId: userId } = client.handshake.auth
    if (userId) {
      this.userConnectionService.removeConnectedClient(userId, client.id)
      this.userConnectionService.broadcastUserOnlineStatus(userId, EUserOnlineStatus.OFFLINE)
      this.userConnectionService.removeChattingConnection(userId)
      this.messageTokensManager.removeAllTokens(userId)
    }
  }

  async recoverMissingMessages(
    clientSocket: TClientSocket,
    messageOffset: TMessageOffset,
    directChatId?: number,
    groupChatId?: number,
    limit?: number
  ): Promise<void> {
    if (directChatId) {
      const messages = await this.messageService.getNewerDirectMessages(
        messageOffset,
        directChatId,
        groupChatId,
        limit ?? 20
      )
      if (messages && messages.length > 0) {
        clientSocket.emit(EMessagingEmitSocketEvents.recovered_connection, messages)
      }
    }
  }

  async checkUniqueMessage(token: string, clientId: number): Promise<void> {
    if (!this.messageTokensManager.isUniqueToken(clientId, token)) {
      throw new BaseWsException(EMsgMessages.MESSAGE_OVERLAPS)
    }
  }

  async handleDirectChatNotExists(
    creatorId: number,
    recipientId: number
  ): Promise<TFindDirectChatWithOtherUser> {
    const directChat = await this.directChatService.findConversationWithOtherUser(
      creatorId,
      recipientId
    )
    if (directChat) {
      return { directChat, isNew: false }
    }
    const newDirectChat = await this.directChatService.createNewDirectChat(creatorId, recipientId)
    return { directChat: newDirectChat, isNew: true }
  }

  async handleSendPushNotification(
    message: TMessageWithAuthor,
    chatType: EChatType,
    receiverIds: TUserId[],
    groupChat?: TGroupChat
  ): Promise<void> {
    for (const receiverId of receiverIds) {
      await this.pushNotificationService.sendNotificationToUser(
        {
          conversation: {
            title:
              chatType === EChatType.DIRECT
                ? message.Author.Profile?.fullName || ''
                : groupChat?.name || '',
            type: chatType,
            avatar:
              chatType === EChatType.DIRECT
                ? message.Author.Profile?.avatar || undefined
                : groupChat?.avatarUrl || undefined,
            message,
          },
          type: 'new_message',
          ttlInSeconds: 60,
          urgency: 'normal',
          topic: 'New_Message',
        },
        receiverId
      )
    }
  }

  async handleEmitNewMessage({
    client,
    receiverId,
    newMessage,
    isNewDirectChat,
    directChat,
    groupChat,
    sender,
  }: THandleEmitNewMessageParams): Promise<void> {
    if (directChat && receiverId) {
      const { socket } = client
      socket.emit(EMessagingEmitSocketEvents.send_message_direct, newMessage)
      this.userConnectionService.sendNewMessageToRecipient(
        receiverId,
        newMessage,
        isNewDirectChat || false,
        directChat,
        sender
      )
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
      this.handleSendPushNotification(newMessage, EChatType.DIRECT, [receiverId])
    } else if (groupChat) {
      this.userConnectionService.sendNewMessageToGroupChat(groupChat.id, newMessage)
      const memberIds = await this.groupMemberService.findGroupChatMemberIds(groupChat.id)
      this.handleSendPushNotification(
        newMessage,
        EChatType.GROUP,
        memberIds.filter((id) => id !== sender.id),
        groupChat
      )
    }
  }

  async handleMessage(
    client: THandleMessageParamsClient,
    message: THandleMessageParamsMessage
  ): Promise<TMessageFullInfo> {
    const { id } = client
    const {
      content,
      timestamp,
      directChatId,
      receiverId,
      groupId,
      stickerId,
      type,
      mediaId,
      replyToId,
    } = message
    if (directChatId && receiverId) {
      const newMessage = await this.messageService.createNewMessage(
        content,
        id,
        timestamp,
        type,
        receiverId,
        stickerId,
        mediaId,
        replyToId,
        directChatId
      )
      const metadata = {
        messageId: newMessage.id,
        authorId: id,
        groupId: groupId || null,
        directChatId: directChatId || null,
        createdAt: new Date().toISOString(),
      }
      await this.directChatService.updateLastSentMessage(directChatId, newMessage.id)
      const embedding = await this.smartSearch.createEmbedding(content)

      await this.smartSearch.saveMessageEmbedding(newMessage.id, embedding, metadata)

      return newMessage
    } else if (groupId) {
      const newMessage = await this.messageService.createNewMessage(
        content,
        id,
        timestamp,
        type,
        undefined,
        stickerId,
        mediaId,
        replyToId,
        undefined,
        groupId
      )
      return newMessage
    }
    throw new BaseWsException(EGatewayMessages.INVALID_MESSAGE_TYPE)
  }

  async checkCanSendMessageInDirectChat(clientId: number, receiverId: number): Promise<void> {
    const settings = await this.userSettingsService.findByUserId(receiverId)
    if (settings?.onlyReceiveFriendMessage) {
      const isFriend = await this.friendService.isFriend(clientId, receiverId)
      if (isFriend) return
      throw new ForbiddenException(EUserSettingsMessages.ONLY_RECEIVE_FRIEND_MESSAGE)
    }
    const isBlocked = await this.blockUserService.checkBlockedUser(clientId, receiverId)
    if (isBlocked?.blockedUserId === clientId)
      throw new ForbiddenException(EUserMessages.YOU_ARE_BLOCKED_BY_THIS_USER)
    if (isBlocked?.blockedUserId === receiverId)
      throw new ForbiddenException(EUserMessages.YOU_HAVE_BLOCKED_THIS_USER)
  }

  @SubscribeMessage(EMessagingListenSocketEvents.send_message_direct)
  @CatchInternalSocketError()
  async handleSendDirectMessage(
    @MessageBody() payload: SendDirectMessageDTO,
    @ConnectedSocket() client: TClientSocket
  ) {
    const { clientId } = await this.authService.validateSocketAuth(client)
    const { type, msgPayload } = payload
    const { receiverId, token } = msgPayload

    await this.checkCanSendMessageInDirectChat(clientId, receiverId)

    await this.checkUniqueMessage(token, clientId)
    const { timestamp, content, replyToId } = msgPayload

    const { directChat, isNew } = await this.handleDirectChatNotExists(clientId, receiverId)
    const { id: directChatId } = directChat

    const sender = await this.userService.findUserWithProfileById(clientId)
    if (!sender) {
      throw new BaseWsException(EGatewayMessages.SENDER_NOT_FOUND)
    }

    let newMessage: TMessageFullInfo

    switch (type) {
      case EMessageTypeAllTypes.TEXT:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content,
            timestamp,
            directChatId,
            receiverId,
            type: EMessageTypes.TEXT,
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.STICKER:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: '',
            timestamp,
            directChatId,
            receiverId,
            type: EMessageTypes.STICKER,
            stickerId: parseInt(content),
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.IMAGE:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: '',
            timestamp,
            directChatId,
            receiverId,
            type: EMessageTypes.MEDIA,
            mediaId: parseInt(content),
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.VIDEO:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: '',
            timestamp,
            directChatId,
            receiverId,
            type: EMessageTypes.MEDIA,
            mediaId: parseInt(content),
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.DOCUMENT:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: msgPayload.content || '', // Tên file
            timestamp,
            directChatId,
            receiverId,
            type: EMessageTypes.MEDIA,
            mediaId: parseInt(content),
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.AUDIO:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: msgPayload.content || '', // Caption nếu có
            timestamp,
            directChatId,
            receiverId,
            type: EMessageTypes.MEDIA,
            mediaId: parseInt(content),
            replyToId,
          }
        )
        break
      default:
        throw new BaseWsException(EGatewayMessages.INVALID_MESSAGE_FORMAT)
    }

    await this.handleEmitNewMessage({
      client: { id: clientId, socket: client },
      receiverId,
      newMessage,
      isNewDirectChat: isNew,
      directChat,
      sender,
    })

    return {
      success: true,
      newMessage,
    }
  }

  @SubscribeMessage(EMessagingListenSocketEvents.client_hello)
  @CatchInternalSocketError()
  async handleClientHello(
    @MessageBody() payload: string,
    @ConnectedSocket() client: TClientSocket
  ) {
    console.log('\n>>> client hello at messaging:', payload)
    const { clientId } = await this.authService.validateSocketAuth(client)
    console.log('>>> client id at messaging:', clientId, '\n')
    return {
      success: true,
    }
  }

  @SubscribeMessage(EMessagingListenSocketEvents.message_seen_direct)
  @CatchInternalSocketError()
  async handleMarkAsSeenInDirectChat(
    @MessageBody() data: MarkAsSeenDTO,
    @ConnectedSocket() client: TClientSocket
  ) {
    const { messageId, receiverId } = data
    await this.messageService.updateMessageStatus(messageId, EMessageStatus.SEEN)
    const recipientSockets = this.userConnectionService.getConnectedClient(receiverId)
    if (recipientSockets && recipientSockets.length > 0) {
      for (const socket of recipientSockets) {
        socket.emit(EMessagingEmitSocketEvents.message_seen_direct, {
          messageId,
          status: EMessageStatus.SEEN,
        })
      }
    }
  }

  @SubscribeMessage(EMessagingListenSocketEvents.typing_direct)
  @CatchInternalSocketError()
  async handleTyping(@MessageBody() data: TypingDTO, @ConnectedSocket() client: TClientSocket) {
    const { clientId } = await this.authService.validateSocketAuth(client)
    const { receiverId, isTyping, directChatId } = data
    const recipientSockets = this.userConnectionService.getConnectedClient(receiverId)
    if (recipientSockets && recipientSockets.length > 0) {
      for (const socket of recipientSockets) {
        socket.emit(EMessagingEmitSocketEvents.typing_direct, isTyping, directChatId)
        if (isTyping) {
          this.convTypingManager.initTyping(clientId, socket, directChatId)
        } else {
          this.convTypingManager.removeTyping(clientId)
        }
      }
    }
  }

  @SubscribeMessage(EMessagingListenSocketEvents.join_group_chat_room)
  @CatchInternalSocketError()
  async handleJoinGroupChat(
    @MessageBody() data: JoinGroupChatDTO,
    @ConnectedSocket() client: Socket
  ) {
    const { groupChatId } = data
    client.join(createGroupChatRoomName(groupChatId))
    return {
      success: true,
    }
  }

  async checkCanSendMessageInGroupChat(
    clientId: number,
    messageType: EMessageTypeAllTypes,
    groupChatId: number
  ): Promise<TCheckCanSendMessageInGroupChat> {
    const member = await this.groupMemberService.findMemberInGroupChat(groupChatId, clientId)
    if (!member) {
      throw new BadGatewayException(EGatewayMessages.USER_NOT_IN_GROUP_CHAT)
    }
    if (member.role !== EGroupChatRoles.ADMIN) {
      const hasPermission = await this.groupChatService.checkGroupChatPermission(
        groupChatId,
        messageType === EMessageTypeAllTypes.PIN_NOTICE
          ? EGroupChatPermissions.PIN_MESSAGE
          : EGroupChatPermissions.SEND_MESSAGE
      )
      if (!hasPermission) {
        throw new BadGatewayException(EGroupMemberMessages.USER_HAS_NO_PERMISSION_SEND_MESSAGE)
      }
    }
    return { member }
  }

  @SubscribeMessage(EMessagingListenSocketEvents.send_message_group)
  @CatchInternalSocketError()
  async handleSendGroupMessage(
    @MessageBody() payload: SendGroupMessageDTO,
    @ConnectedSocket() client: TClientSocket
  ) {
    const { clientId } = await this.authService.validateSocketAuth(client)
    const { type, msgPayload } = payload
    const { groupChatId, token } = msgPayload

    await this.checkUniqueMessage(token, clientId)
    const { timestamp, content, replyToId } = msgPayload

    const { member } = await this.checkCanSendMessageInGroupChat(clientId, type, groupChatId)

    const groupChat = member.GroupChat
    let newMessage: TMessageFullInfo

    switch (type) {
      case EMessageTypeAllTypes.TEXT:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content,
            timestamp,
            groupId: groupChatId,
            type: EMessageTypes.TEXT,
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.STICKER:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: '',
            timestamp,
            groupId: groupChatId,
            type: EMessageTypes.STICKER,
            stickerId: parseInt(content),
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.IMAGE:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: '',
            timestamp,
            groupId: groupChatId,
            type: EMessageTypes.MEDIA,
            mediaId: parseInt(content),
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.VIDEO:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: '',
            timestamp,
            groupId: groupChatId,
            type: EMessageTypes.MEDIA,
            mediaId: parseInt(content),
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.DOCUMENT:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: msgPayload.content || '', // Tên file
            timestamp,
            groupId: groupChatId,
            type: EMessageTypes.MEDIA,
            mediaId: parseInt(content),
            replyToId,
          }
        )
        break
      case EMessageTypeAllTypes.AUDIO:
        newMessage = await this.handleMessage(
          { id: clientId, socket: client },
          {
            content: msgPayload.content || '', // Caption nếu có
            timestamp,
            groupId: groupChatId,
            type: EMessageTypes.MEDIA,
            mediaId: parseInt(content),
            replyToId,
          }
        )
        break
      default:
        throw new BaseWsException(EGatewayMessages.INVALID_MESSAGE_FORMAT)
    }

    // Create embedding for group chat messages with text content
    if (content && content.trim()) {
      const metadata = {
        messageId: newMessage.id,
        authorId: clientId,
        groupId: groupChatId,
        directChatId: null,
        createdAt: new Date().toISOString(),
      }
      const embedding = await this.smartSearch.createEmbedding(content)
      await this.smartSearch.saveMessageEmbedding(newMessage.id, embedding, metadata)
    }

    await this.handleEmitNewMessage({
      client: { id: clientId, socket: client },
      newMessage,
      sender: member.User,
      groupChat,
    })

    return {
      success: true,
      newMessage,
    }
  }

  @SubscribeMessage(EMessagingListenSocketEvents.check_user_online_status)
  @CatchInternalSocketError()
  async handleCheckUserOnlineStatus(@MessageBody() data: CheckUserOnlineDTO) {
    const { userId } = data
    return {
      success: true,
      onlineStatus: this.userConnectionService.getUserOnlineStatus(userId),
    }
  }

  @SubscribeMessage(EMessagingListenSocketEvents.join_direct_chat_room)
  @CatchInternalSocketError()
  async handleJoinDirectChat(
    @MessageBody() data: JoinDirectChatDTO,
    @ConnectedSocket() client: TClientSocket
  ) {
    const { directChatId } = data
    client.join(createDirectChatRoomName(directChatId))
    const directChat = await this.directChatService.findById(directChatId)
    if (directChat) {
      this.userConnectionService.setUserChattingConnection(
        directChat.creatorId,
        directChat.recipientId,
        directChatId
      )
    }
    return {
      success: true,
    }
  }

  @OnEvent(EInternalEvents.REMOVE_GROUP_CHAT_MEMBERS)
  async broadcastRemoveGroupChatMembers(groupChat: TGroupChat, removedMemberIds: number[]) {
    this.userConnectionService.broadcastRemoveGroupChatMembers(groupChat, removedMemberIds)
  }

  @OnEvent(EInternalEvents.ADD_MEMBERS_TO_GROUP_CHAT)
  async broadcastAddMembersToGroupChat(
    groupChat: TGroupChat,
    newMemberIds: number[],
    executor: TUserWithProfile
  ) {
    this.userConnectionService.broadcastAddMembersToGroupChat(groupChat, newMemberIds, executor)
  }

  @OnEvent(EInternalEvents.CREATE_GROUP_CHAT)
  async broadcastCreateGroupChat(
    groupChat: TGroupChat,
    groupMemberIds: number[],
    creator: TUserWithProfile
  ) {
    this.userConnectionService.broadcastCreateGroupChat(groupChat, groupMemberIds, creator)
  }

  @OnEvent(EInternalEvents.UPDATE_GROUP_CHAT_INFO)
  async broadcastUpdateGroupChat(groupChatId: number, groupChat: Partial<TGroupChat>) {
    this.userConnectionService.broadcastUpdateGroupChat(groupChatId, groupChat)
  }

  @OnEvent(EInternalEvents.UPDATE_USER_INFO)
  async broadcastUpdateUserInfo(userId: number, updates: UpdateProfileDto) {
    this.userConnectionService.broadcastUpdateUserInfo(userId, updates)
  }

  @OnEvent(EInternalEvents.DELETE_DIRECT_CHAT)
  async broadcastDeleteDirectChat(directChatId: number, deleter: TUserWithProfile) {
    this.userConnectionService.broadcastDeleteDirectChat(directChatId, deleter)
  }

  @OnEvent(EInternalEvents.DELETE_GROUP_CHAT)
  async broadcastDeleteGroupChat(groupChatId: number) {
    this.userConnectionService.broadcastDeleteGroupChat(groupChatId)
  }

  @OnEvent(EInternalEvents.MEMBER_LEAVE_GROUP_CHAT)
  async broadcastMemberLeaveGroupChat(groupChatId: number, userId: number) {
    this.userConnectionService.broadcastMemberLeaveGroupChat(groupChatId, userId)
  }
}
