import { Injectable } from '@nestjs/common'
import { Server } from 'socket.io'
import { ECallEmitSocketEvents, type ICallEmitSocketEvents } from '@/utils/events/socket.event'
import type { TUserId } from '@/user/user.type'
import type { TServerMiddleware, TSocketId } from './user-connection.type'
import { DevLogger } from '@/dev/dev-logger'
import { EHangupReason, ESDPType, ECallStatus } from '@/call/call.enum'
import type { TCallClientSocket } from '@/utils/events/event.type'
import type { TActiveCallSession } from '@/call/call.type'

@Injectable()
export class CallConnectionService {
  private callServer: Server<{}, ICallEmitSocketEvents>
  private readonly connectedClients = new Map<TUserId, TCallClientSocket[]>()

  setCallServer(server: Server): void {
    this.callServer = server
  }

  getCallServer(): Server {
    return this.callServer
  }

  setCallServerMiddleware(middleware: TServerMiddleware): void {
    this.callServer.use(middleware)
  }

  addConnectedClient(userId: TUserId, client: TCallClientSocket): void {
    const currentClients = this.getConnectedClient(userId)
    if (currentClients && currentClients.length > 0) {
      currentClients.push(client)
    } else {
      this.connectedClients.set(userId, [client])
    }
    this.printOutData('after add connected client:')
  }

  getConnectedClient(clientId: TUserId): TCallClientSocket[] | null {
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

  printOutData(prefixMessage?: string) {
    if (prefixMessage) {
      DevLogger.logInfo(`\n${prefixMessage}`)
    }
    for (const [key, value] of this.connectedClients) {
      for (const client of value) {
        DevLogger.logInfo(`key: ${key} - something: ${client.handshake?.auth.clientId}`)
      }
    }
  }

  announceCallRequestToCallee(activeCallSession: TActiveCallSession) {
    const calleeSockets = this.getConnectedClient(activeCallSession.calleeUserId)
    if (calleeSockets && calleeSockets.length > 0) {
      for (const socket of calleeSockets) {
        socket.emit(ECallEmitSocketEvents.call_request, activeCallSession)
      }
    }
  }

  announceCallStatus(userId: TUserId, status: ECallStatus, activeCallSession?: TActiveCallSession) {
    const userSockets = this.getConnectedClient(userId)
    if (userSockets && userSockets.length > 0) {
      for (const socket of userSockets) {
        socket.emit(ECallEmitSocketEvents.call_status, status, activeCallSession)
      }
    }
  }

  announceSDPOfferAnswer(userId: TUserId, SDP: string, type: ESDPType) {
    const userSockets = this.getConnectedClient(userId)
    if (userSockets && userSockets.length > 0) {
      for (const socket of userSockets) {
        socket.emit(ECallEmitSocketEvents.call_offer_answer, SDP, type)
      }
    }
  }

  announceIceCandidate(
    userId: TUserId,
    candidate: string,
    sdpMid?: string,
    sdpMLineIndex?: number
  ) {
    const userSockets = this.getConnectedClient(userId)
    if (userSockets && userSockets.length > 0) {
      for (const socket of userSockets) {
        socket.emit(ECallEmitSocketEvents.call_ice, candidate, sdpMid, sdpMLineIndex)
      }
    }
  }

  announceCallHangup(userId: TUserId, reason?: EHangupReason) {
    const userSockets = this.getConnectedClient(userId)
    if (userSockets && userSockets.length > 0) {
      for (const socket of userSockets) {
        socket.emit(ECallEmitSocketEvents.call_hangup, reason)
      }
    }
  }
}
