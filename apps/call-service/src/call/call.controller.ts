import {
  Controller,
  Post,
  Body,
  Get,
  UseInterceptors,
  ClassSerializerInterceptor,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common'
import { EAppRoles, ERoutes } from '@/utils/enums'
import { CallService } from './call.service'
import { User } from './call.decorator'
import type { TUserId } from '@/user/user.type'

@Controller(ERoutes.CALL)
export class CallController {
  constructor(private callService: CallService) {}

  @Post('get-token')
  async getToken(
    @User('id') userId: TUserId,
    @Body() body: { channelName: string; sessionId?: string }
  ) {
    const { channelName, sessionId } = body

    if (!channelName) {
      throw new BadRequestException('Channel name is required')
    }

    // Nếu có sessionId, verify user có quyền join session này không
    if (sessionId) {
      const session = this.callService.getActiveCallSession(sessionId)
      if (!session) {
        throw new BadRequestException('Session not found')
      }

      // Chỉ caller hoặc callee mới được lấy token
      if (session.callerUserId !== userId && session.calleeUserId !== userId) {
        throw new UnauthorizedException('You are not part of this call')
      }
    }

    // Generate tokens
    const rtcToken = this.callService.generateRtcToken(channelName, userId)
    const rtmToken = this.callService.generateRtmToken(userId)

    return {
      rtcToken,
      rtmToken,
      uid: userId,
      channelName,
    }
  }
}
