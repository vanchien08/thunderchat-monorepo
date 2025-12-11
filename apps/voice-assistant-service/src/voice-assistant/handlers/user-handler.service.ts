// src/voice-assistant/handlers/user-handler.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@/configs/db/prisma.service';
import { EProviderTokens } from '@/utils/enums';
import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-text-encryptor.crypto';
import { ExecutionResult } from '../voice-assistant.interface';

@Injectable()
export class UserHandlerService {
  private readonly logger = new Logger(UserHandlerService.name);
  private readonly symmetricTextEncryptor = new SymmetricTextEncryptor();

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prisma: PrismaService,
  ) {}

  async prepareChangeUserName(
    userId: number,
    params: { newName: string },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareChangeUserName] user=${userId}, newName="${params.newName}"`,
    );

    if (!params.newName || params.newName.trim().length === 0) {
      return {
        response: 'Tên mới không được để trống. Vui lòng nói tên mới.',
      };
    }

    if (params.newName.length > 100) {
      return {
        response: 'Tên quá dài (tối đa 100 ký tự). Vui lòng nói tên ngắn hơn.',
      };
    }

    const confirmationMessage = `Đổi tên thành "${params.newName}". Xác nhận không? Nói "có" để đổi.`;

    return {
      response: confirmationMessage,
      pending: {
        type: 'change_user_name',
        targetId: userId,
        targetName: 'User',
        content: params.newName,
        lastBotMessage: confirmationMessage,
      } as any,
    };
  }

  async reallyChangeUserName(userId: number, newName: string): Promise<void> {
    this.logger.log(
      `[reallyChangeUserName] user=${userId}, newName="${newName}"`,
    );

    const updated = await this.prisma.profile.update({
      where: { userId },
      data: { fullName: newName },
    });

    this.logger.log(`[reallyChangeUserName] Profile updated: ${updated.id}`);
  }

  async reallySearchMessage(
    userId: number,
    searchKeyword: string,
  ): Promise<string> {
    this.logger.log(
      `[reallySearchMessage] user=${userId}, keyword="${searchKeyword}"`,
    );

    const directMessages = await this.prisma.message.findMany({
      where: {
        directChatId: { not: null },
        DirectChat: {
          OR: [{ creatorId: userId }, { recipientId: userId }],
        },
        isDeleted: false,
      },
      include: {
        Author: { select: { Profile: { select: { fullName: true } } } },
        DirectChat: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const groupMessages = await this.prisma.message.findMany({
      where: {
        groupChatId: { not: null },
        GroupChat: {
          Members: { some: { userId } },
        },
        isDeleted: false,
      },
      include: {
        Author: { select: { Profile: { select: { fullName: true } } } },
        GroupChat: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const allMessages = [...directMessages, ...groupMessages];
    const matches: any[] = [];

    const secretKey = process.env.MESSAGES_ENCRYPTION_SECRET_KEY;
    if (!secretKey) {
      return 'Lỗi hệ thống: Không thể tìm kiếm tin nhắn.';
    }

    for (const msg of allMessages) {
      try {
        if (!msg.dek || !msg.content) continue;

        const dek = this.symmetricTextEncryptor.decrypt(msg.dek, secretKey);
        const decryptedContent = this.symmetricTextEncryptor.decrypt(
          msg.content,
          dek,
        );

        if (
          decryptedContent.toLowerCase().includes(searchKeyword.toLowerCase())
        ) {
          matches.push({
            ...msg,
            decryptedContent,
          });
        }
      } catch (err) {
        this.logger.warn(
          `[reallySearchMessage] Failed to decrypt message ${msg.id}`,
        );
      }
    }

    if (matches.length === 0) {
      return `Không tìm thấy tin nhắn nào chứa "${searchKeyword}".`;
    }

    const top5 = matches.slice(0, 5);
    let result = `Tìm thấy ${matches.length} tin nhắn chứa "${searchKeyword}". `;
    result += `Dưới đây là ${top5.length} tin nhắn gần nhất: `;

    for (const m of top5) {
      const senderName = m.Author?.Profile?.fullName || 'Ai đó';
      const chatName = m.DirectChat ? 'Direct' : m.GroupChat?.name || 'Unknown';
      result += `${senderName} trong ${chatName}: ${m.decryptedContent}. `;
    }

    return result;
  }
}
