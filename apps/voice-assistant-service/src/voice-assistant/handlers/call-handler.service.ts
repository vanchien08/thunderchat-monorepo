// src/voice-assistant/handlers/call-handler.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@/configs/db/prisma.service';
import { EProviderTokens } from '@/utils/enums';
import { FuzzySearchService } from '../../utils/fuzzy-search.service';
import { ExecutionResult } from '../voice-assistant.interface';

@Injectable()
export class CallHandlerService {
  private readonly logger = new Logger(CallHandlerService.name);

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prisma: PrismaService,
    private readonly fuzzySearchService: FuzzySearchService,
  ) {}

  async prepareMakeCall(
    userId: number,
    params: { contactName: string; isVideo: boolean },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareMakeCall] user=${userId}, contact=${params.contactName}`,
    );

    const contact = await this.fuzzySearchService.fuzzyFindContact(
      userId,
      params.contactName,
    );

    if (!contact) {
      return {
        response: `Không tìm thấy ${params.contactName} trong danh sách bạn bè của bạn.`,
      };
    }

    if (contact.type === 'group') {
      return {
        response: 'Hiện tại không hỗ trợ gọi group. Vui lòng gọi 1-1.',
      };
    }

    const callType = params.isVideo ? 'video' : 'thoại';
    const confirmationMessage = `Gọi ${callType} cho ${contact.fullName}. Xác nhận không? Nói "có" để gọi.`;

    if (!contact.directChatId) {
      return { response: 'Không tìm thấy cuộc hội thoại.' };
    }

    const directChat = await this.prisma.directChat.findUnique({
      where: { id: contact.directChatId },
    });

    if (!directChat) {
      return { response: 'Không tìm thấy cuộc hội thoại.' };
    }

    const calleeUserId =
      directChat.creatorId === userId
        ? directChat.recipientId
        : directChat.creatorId;

    return {
      response: confirmationMessage,
      pending: {
        type: 'make_call',
        targetId: directChat.id, // direct chat id
        targetName: contact.fullName,
        content: '',
        lastBotMessage: confirmationMessage,
        isVideo: params.isVideo,

        calleeUserId,
      } as any,
    };
  }

  async prepareMakeCallById(
    userId: number,
    params: { contactId?: string; contactType?: string; isVideo: boolean },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareMakeCallById] user=${userId}, contactId=${params.contactId}, contactType=${params.contactType}`,
    );

    if (!params.contactId) {
      return {
        response:
          'Không tìm thấy liên hệ. Vui lòng nói tên người bạn muốn gọi.',
      };
    }

    const contactId = parseInt(params.contactId);

    // Check based on contactType if provided
    if (params.contactType === 'group') {
      const groupChat = await this.prisma.groupChat.findUnique({
        where: { id: contactId },
      });

      if (groupChat) {
        const callType = params.isVideo ? 'video' : 'thoại';
        const confirmationMessage = `Gọi ${callType} nhóm ${groupChat.name}. Xác nhận không? Nói "có" để gọi.`;

        return {
          response: confirmationMessage,
          pending: {
            type: 'make_call',
            targetId: groupChat.id,
            targetName: groupChat.name,
            content: '',
            lastBotMessage: confirmationMessage,
            isVideo: params.isVideo,
            chatType: 'group',
            groupId: groupChat.id,
          } as any,
        };
      }
    } else if (params.contactType === 'direct') {
      const directChat = await this.prisma.directChat.findUnique({
        where: { id: contactId },
        include: {
          Creator: { select: { Profile: { select: { fullName: true } } } },
          Recipient: { select: { Profile: { select: { fullName: true } } } },
        },
      });

      if (directChat) {
        const otherUser =
          directChat.creatorId === userId
            ? directChat.Recipient
            : directChat.Creator;
        const targetName = otherUser?.Profile?.fullName || 'Unknown';
        const callType = params.isVideo ? 'video' : 'thoại';

        const confirmationMessage = `Gọi ${callType} cho ${targetName}. Xác nhận không? Nói "có" để gọi.`;

        const calleeUserId =
          directChat.recipientId === userId
            ? directChat.creatorId
            : directChat.recipientId;

        return {
          response: confirmationMessage,
          pending: {
            type: 'make_call',
            targetId: directChat.id,
            targetName,
            content: '',
            lastBotMessage: confirmationMessage,
            isVideo: params.isVideo,
            calleeUserId,
            chatType: 'direct',
            directChatId: directChat.id,
          } as any,
        };
      }
    } else {
      // Fallback: Try direct chat first (more common), then group chat
      const directChat = await this.prisma.directChat.findUnique({
        where: { id: contactId },
        include: {
          Creator: { select: { Profile: { select: { fullName: true } } } },
          Recipient: { select: { Profile: { select: { fullName: true } } } },
        },
      });

      if (directChat) {
        const otherUser =
          directChat.creatorId === userId
            ? directChat.Recipient
            : directChat.Creator;
        const targetName = otherUser?.Profile?.fullName || 'Unknown';
        const callType = params.isVideo ? 'video' : 'thoại';

        const confirmationMessage = `Gọi ${callType} cho ${targetName}. Xác nhận không? Nói "có" để gọi.`;

        const calleeUserId =
          directChat.recipientId === userId
            ? directChat.creatorId
            : directChat.recipientId;

        return {
          response: confirmationMessage,
          pending: {
            type: 'make_call',
            targetId: directChat.id,
            targetName,
            content: '',
            lastBotMessage: confirmationMessage,
            isVideo: params.isVideo,
            calleeUserId,
            chatType: 'direct',
            directChatId: directChat.id,
          } as any,
        };
      }

      const groupChat = await this.prisma.groupChat.findUnique({
        where: { id: contactId },
      });

      if (groupChat) {
        const callType = params.isVideo ? 'video' : 'thoại';
        const confirmationMessage = `Gọi ${callType} nhóm ${groupChat.name}. Xác nhận không? Nói "có" để gọi.`;

        return {
          response: confirmationMessage,
          pending: {
            type: 'make_call',
            targetId: groupChat.id,
            targetName: groupChat.name,
            content: '',
            lastBotMessage: confirmationMessage,
            isVideo: params.isVideo,
            chatType: 'group',
            groupId: groupChat.id,
          } as any,
        };
      }
    }

    return {
      response: 'Không tìm thấy liên hệ. Vui lòng thử lại.',
    };
  }

  async readMissedCalls(userId: number): Promise<ExecutionResult> {
    this.logger.log(`[readMissedCalls] Starting for user ${userId}`);

    try {
      // Query missed calls where user is the callee
      const missedCalls = await this.prisma.callSession.findMany({
        where: {
          calleeUserId: userId,
          status: {
            in: ['MISSED', 'NO_ANSWER', 'REJECTED', 'TIMEOUT', 'CANCELLED'],
          },
        },
        include: {
          Caller: {
            select: {
              Profile: {
                select: { fullName: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });

      this.logger.log(
        `[readMissedCalls] Found ${missedCalls.length} missed calls`,
      );

      if (missedCalls.length === 0) {
        return {
          response: 'Bạn không có cuộc gọi nhỡ nào.',
        };
      }

      let speech = `Bạn có ${missedCalls.length} cuộc gọi nhỡ. `;

      for (const call of missedCalls.slice(0, 5)) {
        const callerName = call.Caller?.Profile?.fullName || 'Ai đó';
        const callType = call.isVideoCall ? 'video' : 'thoại';
        const timeAgo = this.formatTimeAgo(call.createdAt);
        const statusText = this.getStatusText(call.status);
        speech += `${callerName} đã gọi ${callType} ${timeAgo} (${statusText}). `;
      }

      return { response: speech };
    } catch (err) {
      this.logger.warn(`[readMissedCalls] Error: ${(err as Error).message}`);
      return { response: 'Lỗi khi đọc cuộc gọi nhỡ.' };
    }
  }

  private formatTimeAgo(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'vừa xong';
    if (diffMins < 60) return `${diffMins} phút trước`;
    if (diffHours < 24) return `${diffHours} giờ trước`;
    return `${diffDays} ngày trước`;
  }

  private getStatusText(status: string | null): string {
    if (!status) return 'không xác định';
    const statusMap: Record<string, string> = {
      CANCELLED: 'bị hủy',
      REJECTED: 'bị từ chối',
      TIMEOUT: 'hết hạn',
      BUSY: 'bận',
      OFFLINE: 'không trực tuyến',
      MISSED: 'nhỡ',
      NO_ANSWER: 'không trả lời',
    };
    return statusMap[status] || status;
  }
}
