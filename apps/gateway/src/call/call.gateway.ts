import { NotFoundException, UseFilters } from '@nestjs/common'
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
import {
  CallRequestDTO,
  CallAcceptDTO,
  CallRejectDTO,
  SDPOfferAnswerDTO,
  IceCandidateDTO,
  CallHangupDTO,
} from './call.dto'
import { ECallMessages } from './call.message'
import { CatchInternalSocketError } from '@/utils/exception-filters/base-ws-exception.filter'
import type { TCallSessionActiveId } from './call.type'
import { ECallListenSocketEvents, ECallEmitSocketEvents } from '@/utils/events/socket.event'
import type { ICallGateway } from './call.interface'
import { ECallStatus } from './call.enum'
import { AuthService } from '@/auth/auth.service'
import { DevLogger } from '@/dev/dev-logger'
import type { TClientSocket, TCallClientSocket } from '@/utils/events/event.type'
import { ESocketNamespaces } from '@/messaging/messaging.enum'
import { BaseWsExceptionsFilter } from '@/utils/exception-filters/base-ws-exception.filter'
import { UseInterceptors, UsePipes } from '@nestjs/common'
import { gatewayValidationPipe } from '@/utils/validation/gateway.validation'
import { CallGatewayInterceptor } from './call.interceptor'
import { CallConnectionService } from '@/connection/voice-call-connection.service'

@WebSocketGateway({
  cors: {
    origin: true,
    credentials: true,
  },
  namespace: ESocketNamespaces.voice_call,
})
@UseFilters(new BaseWsExceptionsFilter())
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

  constructor(
    private readonly callService: CallService,
    private readonly callConnectionService: CallConnectionService,
    private readonly authService: AuthService
  ) {}

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
      const { userId } = await this.authService.validateVoiceCallSocketAuth(client)
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
      await this.callService.endCall(session.id)

      // 🔔 thông báo cho phía còn lại
      const peerId = session.callerUserId === userId ? session.calleeUserId : session.callerUserId

      this.callConnectionService.announceCallStatus(peerId, ECallStatus.ENDED, session)
    } catch (error) {
      DevLogger.logForWebsocket('error at handleDisconnect:', error)
    }
  }

  async autoCancelCall(sessionId: TCallSessionActiveId) {
    setTimeout(() => {
      const session = this.callService.getActiveCallSession(sessionId)
      if (
        session &&
        (session.status === ECallStatus.REQUESTING || session.status === ECallStatus.RINGING)
      ) {
        this.callService.endCall(sessionId)
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
    }, this.callTimeoutMs)
  }

  @SubscribeMessage(ECallListenSocketEvents.client_hello)
  @CatchInternalSocketError()
  async handleClientHello(
    @MessageBody() payload: string,
    @ConnectedSocket() client: TCallClientSocket
  ) {
    console.log('\n>>> client hello at voice call:', payload)
    const { userId } = await this.authService.validateVoiceCallSocketAuth(client)
    console.log('>>> client id at voice call:', userId, '\n')
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
    const { userId: callerUserId } = await this.authService.validateVoiceCallSocketAuth(client)
    const { calleeUserId, directChatId, isVideoCall = false } = payload
    if (!this.callConnectionService.checkUserIsConnected(calleeUserId)) {
      return { status: ECallStatus.OFFLINE } // thông báo cho caller rằng callee đang offline
    }
    if (this.callService.isUserBusy(calleeUserId)) {
      return { status: ECallStatus.BUSY } // thông báo cho caller rằng callee đang bận
    }
    const session = await this.callService.initActiveCallSession(
      callerUserId,
      calleeUserId,
      directChatId,
      isVideoCall
    )

    // báo cho callee có cuộc gọi đến
    this.callConnectionService.announceCallRequestToCallee(session)
    // tự động hủy cuộc gọi nếu không có phản hồi
    this.autoCancelCall(session.id)

    return { status: ECallStatus.REQUESTING, session }
  }

  @SubscribeMessage(ECallListenSocketEvents.call_accept)
  async onAccept(@MessageBody() dto: CallAcceptDTO) {
    const session = await this.callService.acceptCall(dto.sessionId)
    this.callConnectionService.announceCallStatus(
      session.callerUserId,
      ECallStatus.ACCEPTED,
      session
    )
  }

  @SubscribeMessage(ECallListenSocketEvents.call_reject)
  async onReject(@MessageBody() dto: CallRejectDTO) {
    const session = await this.callService.endCall(dto.sessionId)
    this.callConnectionService.announceCallStatus(
      session.callerUserId,
      ECallStatus.REJECTED,
      session
    )
  }

  @SubscribeMessage(ECallListenSocketEvents.call_offer_answer)
  async onOfferAnswer(
    @ConnectedSocket() client: TCallClientSocket,
    @MessageBody() payload: SDPOfferAnswerDTO
  ) {
    const session = this.callService.getActiveCallSession(payload.sessionId)
    if (!session) {
      throw new NotFoundException(ECallMessages.SESSION_NOT_FOUND)
    }
    const { userId } = await this.authService.validateVoiceCallSocketAuth(client)
    const { callerUserId, calleeUserId } = session
    const peerId = userId === callerUserId ? calleeUserId : callerUserId
    this.callConnectionService.announceSDPOfferAnswer(peerId, payload.SDP, payload.type)
  }

  @SubscribeMessage(ECallListenSocketEvents.call_ice)
  async onIce(@ConnectedSocket() client: TCallClientSocket, @MessageBody() dto: IceCandidateDTO) {
    const session = this.callService.getActiveCallSession(dto.sessionId)
    if (!session) {
      throw new NotFoundException(ECallMessages.SESSION_NOT_FOUND)
    }
    const { userId } = await this.authService.validateVoiceCallSocketAuth(client)
    const { callerUserId, calleeUserId } = session
    const peerId = userId === callerUserId ? calleeUserId : callerUserId
    this.callConnectionService.announceIceCandidate(
      peerId,
      dto.candidate,
      dto.sdpMid,
      dto.sdpMLineIndex
    )
  }

  @SubscribeMessage(ECallListenSocketEvents.call_hangup)
  async onHangup(@ConnectedSocket() client: TCallClientSocket, @MessageBody() dto: CallHangupDTO) {
    const session = this.callService.getActiveCallSession(dto.sessionId)
    if (!session) {
      throw new NotFoundException(ECallMessages.SESSION_NOT_FOUND)
    }
    const { userId } = await this.authService.validateVoiceCallSocketAuth(client)
    const { callerUserId, calleeUserId } = session
    const peerId = userId === callerUserId ? calleeUserId : callerUserId
    this.callService.endCall(session.id)
    this.callConnectionService.announceCallHangup(peerId, dto.reason)
  }
}
