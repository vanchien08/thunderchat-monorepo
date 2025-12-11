import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { TUserId } from '@/user/user.type'
import { ECallMessages } from './call.message'
import { EProviderTokens } from '@/utils/enums'
import { PrismaService } from '@/configs/db/prisma.service'
import type { TActiveCallSession, TCallSessionActiveId } from './call.type'
import type { TDirectChat } from '@/utils/entities/direct-chat.entity'
import { v4 as uuidv4 } from 'uuid'
import { EHangupReason, ECallStatus } from './call.enum'

@Injectable()
export class CallService {
  private readonly MAX_RETRY_COUNT_CREATE_TEMP_SESSION: number = 3
  private readonly activeCallSessions = new Map<TCallSessionActiveId, TActiveCallSession>()
  private readonly usersCalling = new Map<TUserId, TCallSessionActiveId>() // để tra cứu các user nào đang gọi
  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService) {}
  getActiveCallSession(sessionId: TCallSessionActiveId): TActiveCallSession | undefined {
    return this.activeCallSessions.get(sessionId)
  }
  async initActiveCallSession(
    callerUserId: TUserId,
    calleeUserId: TUserId,
    directChatId: TDirectChat['id'],
    isVideoCall: boolean = false
  ): Promise<TActiveCallSession> {
    let tempSessionId = uuidv4()
    let retryCount: number = 0
    while (this.activeCallSessions.has(tempSessionId)) {
      retryCount++
      if (retryCount === this.MAX_RETRY_COUNT_CREATE_TEMP_SESSION) {
        throw new BadRequestException(ECallMessages.SOMETHING_WENT_WRONG)
      }
      tempSessionId = uuidv4()
    }
    const session: TActiveCallSession = {
      id: tempSessionId,
      status: ECallStatus.REQUESTING,
      callerUserId,
      calleeUserId,
      directChatId,
      isVideoCall,
    }
    try {
      await this.createDbSession(session)
    } catch (error) {
      // Xử lý lỗi DB mà không break signaling (log và tiếp tục)
      console.error('Failed to create DB session:', error)
      // Optional: Throw nếu muốn fail fast, nhưng giữ in-memory
    }
    this.activeCallSessions.set(tempSessionId, session)
    return session
  }

  // async checkCallRequestInProgress(callerUserId: TUserId, calleeUserId: TUserId): Promise<boolean> {
  //   const count = await this.prismaService.voiceCallSession.count({
  //     where: {
  //       endedAt: null,
  //     },
  //   })
  //   return count > 0
  // }

  // async createSession(
  //   callerUserId: TUserId,
  //   calleeUserId: TUserId,
  //   directChatId?: number
  // ): Promise<TVoiceCallSession> {
  //   // nếu callee đang bận
  //   if (this.usersCalling.has(calleeUserId)) {
  //     throw new BadRequestException(EVoiceCallMessage.CALLEE_BUSY)
  //   }
  //   const inProgress = await this.checkCallRequestInProgress(callerUserId, calleeUserId)
  //   if (inProgress) {
  //     throw new BadRequestException(EVoiceCallMessage.TOO_MANY_CALLS)
  //   }
  //   const session = await this.prismaService.voiceCallSession.create({
  //     data: {
  //       callerUserId,
  //       calleeUserId,
  //       directChatId,
  //     },
  //   })
  //   this.activeCallSessions.set(session.id, { ...session, status: EVoiceCallStatus.REQUESTING })
  //   this.usersCalling.set(callerUserId, session.id)
  //   this.usersCalling.set(calleeUserId, session.id)
  //   return session
  // }

  async createDbSession(session: TActiveCallSession): Promise<void> {
    await this.prismaService.callSession.create({
      data: {
        id: session.id,
        directChatId: session.directChatId,
        callerUserId: session.callerUserId,
        calleeUserId: session.calleeUserId,
        status: session.status,
        isVideoCall: session.isVideoCall || false,
      },
    })
  }

  async updateDbSessionStatus(
    sessionId: TCallSessionActiveId,
    status: ECallStatus,
    hangupReason?: EHangupReason
  ): Promise<void> {
    const updateData: any = { status }
    if (
      status === ECallStatus.ENDED ||
      status === ECallStatus.REJECTED ||
      status === ECallStatus.TIMEOUT
    ) {
      updateData.endedAt = new Date()
      updateData.hangupReason = hangupReason || EHangupReason.NORMAL
    }
    await this.prismaService.callSession.update({
      where: { id: sessionId },
      data: updateData,
    })
  }

  async acceptCall(sessionId: TCallSessionActiveId): Promise<TActiveCallSession> {
    const session = this.getActiveCallSession(sessionId)
    if (!session) {
      throw new NotFoundException(ECallMessages.SESSION_NOT_FOUND)
    }
    if (session.status !== ECallStatus.REQUESTING && session.status !== ECallStatus.RINGING) {
      throw new BadRequestException(ECallMessages.INVALID_STATUS)
    }
    session.status = ECallStatus.ACCEPTED

    try {
      await this.updateDbSessionStatus(sessionId, ECallStatus.ACCEPTED)
    } catch (error) {
      console.error('Failed to update DB on accept:', error)
    }
    return session
  }

  async updateCallStatus(
    sessionId: TCallSessionActiveId,
    status: ECallStatus
  ): Promise<TActiveCallSession> {
    const session = this.getActiveCallSession(sessionId)
    if (!session) {
      throw new NotFoundException(ECallMessages.SESSION_NOT_FOUND)
    }
    session.status = status
    if (status === ECallStatus.CONNECTED || status === ECallStatus.ENDED) {
      try {
        await this.updateDbSessionStatus(sessionId, status)
      } catch (error) {
        console.error('Failed to update DB status:', error)
      }
    }
    return session
  }

  // connectCall(sessionId: TVoiceCallSessionId): TVoiceCallSession {
  //   const session = this.callSessions.get(sessionId)
  //   if (!session) {
  //     throw new NotFoundException(EVoiceCallMessage.SESSION_NOT_FOUND)
  //   }
  //   session.status = EVoiceCallSessionStatus.CONNECTED
  //   return session
  // }

  findSessionByUserId(userId: TUserId): TActiveCallSession | undefined {
    for (const session of this.activeCallSessions.values()) {
      if (session.callerUserId === userId || session.calleeUserId === userId) {
        return session
      }
    }
    return undefined
  }

  async endCall(
    sessionId: TCallSessionActiveId,
    reason: EHangupReason = EHangupReason.NORMAL
  ): Promise<TActiveCallSession> {
    const session = this.getActiveCallSession(sessionId)

    if (!session) {
      throw new NotFoundException(ECallMessages.SESSION_NOT_FOUND)
    }

    try {
      await this.updateDbSessionStatus(sessionId, ECallStatus.ENDED, reason)
    } catch (error) {
      console.error('Failed to update DB on end:', error)
    }
    this.activeCallSessions.delete(sessionId)
    if (this.usersCalling.get(session.callerUserId) === sessionId)
      this.usersCalling.delete(session.callerUserId)
    if (this.usersCalling.get(session.calleeUserId) === sessionId)
      this.usersCalling.delete(session.calleeUserId)
    return session
  }

  isUserBusy(userId: TUserId): boolean {
    return this.usersCalling.has(userId)
  }
}
