import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common'
import type { TUserId } from '@/user/user.type'
import { ECallMessages } from './call.message'
import { EProviderTokens } from '@/utils/enums'
import { PrismaService } from '@/configs/db/prisma.service'
import type { TActiveCallSession, TCallSessionActiveId } from './call.type'
import type { TDirectChat } from '@/utils/entities/direct-chat.entity'
import { v4 as uuidv4 } from 'uuid'
import { EHangupReason, ECallStatus } from './call.enum'
import { RtcTokenBuilder, RtcRole, RtmTokenBuilder, RtmRole } from 'agora-access-token'
@Injectable()
export class CallService {
  private readonly MAX_RETRY_COUNT_CREATE_TEMP_SESSION: number = 3
  private readonly activeCallSessions = new Map<TCallSessionActiveId, TActiveCallSession>()
  private readonly usersCalling = new Map<TUserId, TCallSessionActiveId>() // để tra cứu các user nào đang gọi
  constructor(@Inject(EProviderTokens.PRISMA_CLIENT) private prismaService: PrismaService) {}

  getActiveCallSession(sessionId: TCallSessionActiveId): TActiveCallSession | undefined {
    return this.activeCallSessions.get(sessionId)
  }

  async initActiveCallSession(session: TActiveCallSession): Promise<TActiveCallSession> {
    console.log(`📝 initActiveCallSession called with:`, {
      id: session.id,
      caller: session.callerUserId,
      callee: session.calleeUserId,
      status: session.status,
    })

    // Lưu vào DB (lấy từ frontend)
    try {
      await this.prismaService.callSession.create({
        data: {
          id: session.id,
          directChatId: session.directChatId,
          callerUserId: session.callerUserId,
          calleeUserId: session.calleeUserId,
          status: session.status,
          isVideoCall: session.isVideoCall,
        },
      })
      console.log(`✅ DB session created: ${session.id}`)
    } catch (error) {
      console.error(`❌ DB session creation failed: ${session.id}`, error)
      // Tiếp tục, không throw - vẫn track in-memory
    }

    // Lưu vào in-memory map
    this.activeCallSessions.set(session.id, session)
    this.usersCalling.set(session.callerUserId, session.id)
    this.usersCalling.set(session.calleeUserId, session.id)

    console.log(`✅ Session stored in memory: ${session.id}`)
    console.log(`   Active sessions count: ${this.activeCallSessions.size}`)
    console.log(`   All session IDs:`, Array.from(this.activeCallSessions.keys()))

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
  // ): Promise<TCallSession> {
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

  // Deprecated - createDbSession logic moved to initActiveCallSession

  async saveCallStatusToDb(
    sessionId: TCallSessionActiveId,
    status: ECallStatus,
    reason?: EHangupReason
  ): Promise<void> {
    try {
      const updateData: any = { status }

      if (
        status === ECallStatus.ENDED ||
        status === ECallStatus.REJECTED ||
        status === ECallStatus.TIMEOUT
      ) {
        updateData.endedAt = new Date()
        updateData.hangupReason = reason || EHangupReason.NORMAL
      }

      await this.prismaService.callSession.update({
        where: { id: sessionId },
        data: updateData,
      })
      console.log(`✅ DB status updated: ${sessionId} → ${status}`)
    } catch (error) {
      console.error(`❌ DB status update failed: ${sessionId} → ${status}`, error)
      // Không throw - để call tiếp tục ngay cả khi DB fail
    }
  }

  async acceptCall(
    sessionId: TCallSessionActiveId,
    sessionPayload?: TActiveCallSession
  ): Promise<TActiveCallSession> {
    let session = this.getActiveCallSession(sessionId)

    // Nếu in-memory không có, lấy từ payload (frontend gửi)
    if (!session && sessionPayload) {
      console.log(`📨 Session not in memory, using payload for: ${sessionId}`)
      session = sessionPayload
      // Lưu vào in-memory + DB
      this.activeCallSessions.set(sessionId, session)
      this.usersCalling.set(session.callerUserId, sessionId)
      this.usersCalling.set(session.calleeUserId, sessionId)
      // Cũng insert vào DB
      try {
        await this.prismaService.callSession.create({
          data: {
            id: session.id,
            directChatId: session.directChatId,
            callerUserId: session.callerUserId,
            calleeUserId: session.calleeUserId,
            status: session.status,
            isVideoCall: session.isVideoCall,
          },
        })
        console.log(`✅ DB session created from payload: ${sessionId}`)
      } catch (error) {
        console.error(`❌ DB session creation failed: ${sessionId}`, error)
      }
    }

    if (!session) {
      console.error(`❌ acceptCall: Session not found! sessionId: ${sessionId}`)
      throw new NotFoundException(ECallMessages.SESSION_NOT_FOUND)
    }

    // Update in-memory
    session.status = ECallStatus.ACCEPTED

    // Save to DB
    await this.saveCallStatusToDb(sessionId, ECallStatus.ACCEPTED)

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
    await this.saveCallStatusToDb(sessionId, status)
    return session
  }

  // connectCall(sessionId: TCallSessionId): TCallSession {
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
    reason: EHangupReason = EHangupReason.NORMAL,
    sessionPayload?: TActiveCallSession
  ): Promise<TActiveCallSession> {
    let session = this.getActiveCallSession(sessionId)

    // Nếu in-memory không có, lấy từ payload (frontend gửi)
    if (!session && sessionPayload) {
      console.log(`📥 Session not in memory, using payload for: ${sessionId}`)
      session = sessionPayload
      // Lưu vào in-memory + DB
      this.activeCallSessions.set(sessionId, session)
      this.usersCalling.set(session.callerUserId, sessionId)
      this.usersCalling.set(session.calleeUserId, sessionId)
      // Cũng insert vào DB
      try {
        await this.prismaService.callSession.create({
          data: {
            id: session.id,
            directChatId: session.directChatId,
            callerUserId: session.callerUserId,
            calleeUserId: session.calleeUserId,
            status: session.status,
            isVideoCall: session.isVideoCall,
          },
        })
        console.log(`✅ DB session created from payload: ${sessionId}`)
      } catch (error) {
        console.error(`❌ DB session creation failed: ${sessionId}`, error)
      }
    }

    if (!session) {
      console.error(`❌ endCall: Session not found! sessionId: ${sessionId}`)
      throw new NotFoundException(ECallMessages.SESSION_NOT_FOUND)
    }

    // Update in-memory
    session.status = ECallStatus.ENDED

    // Save to DB
    await this.saveCallStatusToDb(sessionId, ECallStatus.ENDED, reason)

    // Remove from users calling map
    if (this.usersCalling.get(session.callerUserId) === sessionId) {
      this.usersCalling.delete(session.callerUserId)
    }
    if (this.usersCalling.get(session.calleeUserId) === sessionId) {
      this.usersCalling.delete(session.calleeUserId)
    }

    return session
  }

  isUserBusy(userId: TUserId): boolean {
    return this.usersCalling.has(userId)
  }
  generateRtcToken(channelName: string, uid: TUserId): string {
    const APP_ID = process.env.AGORA_APP_ID
    const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE

    if (!APP_ID || !APP_CERTIFICATE) {
      // Hoặc ném lỗi 500
      throw new BadRequestException('Agora is not configured on server.')
    }

    const role = RtcRole.PUBLISHER
    // Set token hết hạn sau 1 giờ
    const expirationTimeInSeconds = 3600
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

    // buildTokenWithUid yêu cầu uid là SỐ (number)
    const token = RtcTokenBuilder.buildTokenWithUid(
      APP_ID,
      APP_CERTIFICATE,
      channelName,
      Number(uid), // Đảm bảo uid là number
      role,
      privilegeExpiredTs
    )
    return token
  }

  /**
   * Tạo RTM Token (Token để login RTM)
   */
  generateRtmToken(uid: TUserId): string {
    const APP_ID = process.env.AGORA_APP_ID
    const APP_CERTIFICATE = process.env.AGORA_APP_CERTIFICATE

    if (!APP_ID || !APP_CERTIFICATE) {
      throw new BadRequestException('Agora is not configured on server.')
    }

    const role = RtmRole.Rtm_User
    const expirationTimeInSeconds = 3600 // 1 giờ
    const currentTimestamp = Math.floor(Date.now() / 1000)
    const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds

    // buildTokenWithUid của RTM yêu cầu uid là STRING
    const token = RtmTokenBuilder.buildToken(
      APP_ID,
      APP_CERTIFICATE,
      String(uid), // 3. account (uid)
      role, // 4. role (ĐÂY LÀ THAM SỐ BỊ THIẾU)
      privilegeExpiredTs // 5. privilegeExpiredTs
    )
    return token
  }
}
