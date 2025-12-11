import { Inject, NotFoundException, UseFilters, BadRequestException } from '@nestjs/common'
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
} from '@nestjs/websockets'
import { Server } from 'socket.io'
import { CallService } from './call.service'
import { CallRequestDTO, CallAcceptDTO, CallRejectDTO, CallHangupDTO } from './call.dto'
import { ECallMessages } from './call.message'
import { CatchInternalSocketError } from '@/utils/exception-filters/base-ws-exception.filter'
import type { TCallSessionActiveId } from './call.type'
import { ECallListenSocketEvents, ECallEmitSocketEvents } from '@/utils/events/socket.event'
import type { ICallGateway } from './call.interface'
import { ECallStatus, EHangupReason } from './call.enum'
import { DevLogger } from '@/dev/dev-logger'
import type { TClientSocket, TCallClientSocket } from '@/utils/events/event.type'
import { ESocketNamespaces } from '@/messaging/messaging.enum'
import { BaseWsExceptionsFilter } from '@/utils/exception-filters/base-ws-exception.filter'
import { UseInterceptors, UsePipes } from '@nestjs/common'
import { gatewayValidationPipe } from '@/utils/validation/gateway.validation'
import { CallGatewayInterceptor } from './call.interceptor'
import { CallConnectionService } from '@/connection/call-connection.service'
import { EGrpcPackages } from '@/utils/enums'
import { ClientGrpc } from '@nestjs/microservices'
import { AuthService } from '@/configs/communication/grpc/services/auth.service'

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: ESocketNamespaces.voice_call,
})
@UsePipes(gatewayValidationPipe)
@UseInterceptors(CallGatewayInterceptor)
export class CallGateway
  implements
    OnGatewayConnection<TCallClientSocket>,
    OnGatewayDisconnect<TCallClientSocket>,
    OnGatewayInit<Server>,
    ICallGateway
{
  private readonly callTimeoutMs: number = 10000
  private readonly authService: AuthService

  constructor(
    private readonly callService: CallService,
    private readonly callConnectionService: CallConnectionService,
    @Inject(EGrpcPackages.AUTH_PACKAGE) private readonly authClient: ClientGrpc
  ) {
    this.authService = new AuthService(this.authClient.getService('AuthService'))
  }

  /**
   * This function is called (called one time) when the server is initialized.
   * It sets the server and the server middleware.
   * The server middleware is used to validate the socket connection.
   * @param server - The server instance.
   */
  async afterInit(server: Server): Promise<void> {
    this.callConnectionService.setCallServer(server)
    this.callConnectionService.setCallServerMiddleware(async (socket, next) => {
      try {
        await this.authService.validateSocketConnection(socket)
      } catch (error) {
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
  async handleConnection(client: TCallClientSocket): Promise<void> {
    DevLogger.logForWebsocket('connected socket:', {
      socketId: client.id,
      auth: client.handshake.auth,
    })
    try {
      const { userId } = await this.authService.validateCallSocketAuth(client)
      this.callConnectionService.addConnectedClient(userId, client)
      client.emit(ECallEmitSocketEvents.server_hello, 'You connected sucessfully!')
    } catch (error) {
      DevLogger.logForWebsocket('error at handleConnection:', error)
      client.disconnect(true)
    }
  }

  /**
   * This function is called when a client disconnects from the server.
   * It removes the client from the connected clients list and the message tokens.
   * @param client - The client instance.
   */
  async handleDisconnect(client: TCallClientSocket): Promise<void> {
    DevLogger.logForWebsocket('disconnected socket:', {
      socketId: client.id,
      auth: client.handshake.auth,
    })

    const { userId } = client.handshake.auth
    if (!userId) return

    try {
      // 🔍 tìm session mà user này đang tham gia
      const session = this.callService.findSessionByUserId(userId)

      if (!session) {
        DevLogger.logForWebsocket('No active call for user:', userId)
        return
      }

      // 📴 kết thúc cuộc gọi
      const endedSession = await this.callService.endCall(session.id)
      // ✅ Save status change to database (endCall already does this)

      // 🔔 thông báo cho phía còn lại
      const peerId = session.callerUserId === userId ? session.calleeUserId : session.callerUserId

      this.callConnectionService.announceCallStatus(peerId, ECallStatus.ENDED, endedSession)
    } catch (error) {
      DevLogger.logForWebsocket('error at handleDisconnect:', error)
    }
  }

  autoCancelCall(sessionId: TCallSessionActiveId) {
    setTimeout(async () => {
      try {
        const session = this.callService.getActiveCallSession(sessionId)
        if (
          session &&
          (session.status === ECallStatus.REQUESTING || session.status === ECallStatus.RINGING)
        ) {
          // ✅ Save status change to database
          await this.callService.endCall(sessionId)
          this.callConnectionService.announceCallStatus(
            session.callerUserId,
            ECallStatus.TIMEOUT,
            session
          )
          this.callConnectionService.announceCallStatus(
            session.calleeUserId,
            ECallStatus.TIMEOUT,
            session
          )
        }
      } catch (error) {
        DevLogger.logForWebsocket('error in autoCancelCall:', error)
      }
    }, this.callTimeoutMs)
  }

  @SubscribeMessage(ECallListenSocketEvents.client_hello)
  @CatchInternalSocketError()
  async handleClientHello(
    @MessageBody() payload: string,
    @ConnectedSocket() client: TCallClientSocket
  ) {
    console.log('\n>>> client hello at voice call:', payload)
    const { userId } = await this.authService.validateCallSocketAuth(client)
    console.log('>>> client id at voice call:', userId)
    console.log('>>> socket id:', client.id)
    console.log('>>> auth token:', client.handshake.auth, '\n')
    return {
      success: true,
    }
  }

  @SubscribeMessage(ECallListenSocketEvents.call_request)
  @CatchInternalSocketError()
  async onCallRequest(
    @ConnectedSocket() client: TCallClientSocket,
    @MessageBody() payload: CallRequestDTO
  ) {
    try {
      const { userId: callerUserId } = await this.authService.validateCallSocketAuth(client)
      const { sessionId, calleeUserId, directChatId, isVideoCall = false } = payload

      if (!sessionId || !calleeUserId || !directChatId) {
        throw new BadRequestException('Missing sessionId, calleeUserId or directChatId')
      }

      if (!this.callConnectionService.checkUserIsConnected(calleeUserId)) {
        return { status: ECallStatus.OFFLINE }
      }
      if (this.callService.isUserBusy(calleeUserId)) {
        return { status: ECallStatus.BUSY }
      }

      // Tạo session object từ payload
      const sessionObj = {
        id: sessionId,
        callerUserId,
        calleeUserId,
        directChatId,
        isVideoCall,
        status: ECallStatus.REQUESTING,
      }

      // initActiveCallSession sẽ lưu session vào DB và in-memory
      const session = await this.callService.initActiveCallSession(sessionObj)

      console.log(`📞 Call request initiated:`, {
        sessionId: session.id,
        caller: callerUserId,
        callee: calleeUserId,
      })

      // Thông báo cho callee
      this.callConnectionService.announceCallRequestToCallee(session)
      // Tự động hủy nếu không có phản hồi trong 10s
      this.autoCancelCall(session.id)

      return { status: ECallStatus.REQUESTING, session }
    } catch (error) {
      DevLogger.logForWebsocket('Error in onCallRequest:', error)
      throw error
    }
  }

  @SubscribeMessage(ECallListenSocketEvents.call_accept)
  @CatchInternalSocketError()
  async onAccept(@MessageBody() dto: CallAcceptDTO) {
    try {
      const sessionId = dto.session?.id
      if (!sessionId) {
        throw new BadRequestException('Missing sessionId')
      }
      console.log(`📲 Accept call request:`, { sessionId })
      const session = await this.callService.acceptCall(sessionId, dto.session)
      console.log(`✓ Call accepted:`, { sessionId: session.id, status: session.status })
      this.callConnectionService.announceCallStatus(
        session.callerUserId,
        ECallStatus.ACCEPTED,
        session
      )
    } catch (error) {
      DevLogger.logForWebsocket('Error in onAccept:', error)
      throw error
    }
  }
  @SubscribeMessage(ECallListenSocketEvents.call_reject)
  @CatchInternalSocketError()
  async onReject(@MessageBody() dto: CallRejectDTO) {
    try {
      const sessionId = dto.session?.id
      if (!sessionId) {
        throw new BadRequestException('Missing sessionId')
      }
      const session = await this.callService.endCall(sessionId, EHangupReason.NORMAL, dto.session)
      this.callConnectionService.announceCallStatus(
        session.callerUserId,
        ECallStatus.REJECTED,
        session
      )
    } catch (error) {
      DevLogger.logForWebsocket('Error in onReject:', error)
      throw error
    }
  }

  @SubscribeMessage(ECallListenSocketEvents.call_hangup)
  @CatchInternalSocketError()
  async onHangup(@ConnectedSocket() client: TCallClientSocket, @MessageBody() dto: CallHangupDTO) {
    try {
      const sessionId = dto.session?.id
      if (!sessionId) {
        throw new BadRequestException('Missing sessionId')
      }
      const session = this.callService.getActiveCallSession(sessionId) || dto.session

      if (!session) {
        throw new NotFoundException(ECallMessages.SESSION_NOT_FOUND)
      }

      const { userId } = await this.authService.validateCallSocketAuth(client)
      const { callerUserId, calleeUserId } = session
      const peerId = userId === callerUserId ? calleeUserId : callerUserId
      await this.callService.endCall(sessionId, dto.reason, dto.session)
      this.callConnectionService.announceCallHangup(peerId, dto.reason)
    } catch (error) {
      DevLogger.logForWebsocket('Error in onHangup:', error)
      throw error
    }
  }
}
