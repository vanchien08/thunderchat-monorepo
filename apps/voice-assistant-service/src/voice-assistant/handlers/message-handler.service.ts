// src/voice-assistant/handlers/message-handler.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@/configs/db/prisma.service';
import { EProviderTokens } from '@/utils/enums';
import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-text-encryptor.crypto';
import { FuzzySearchService } from '../../utils/fuzzy-search.service';
import { ExecutionResult, PendingAction } from '../voice-assistant.interface';
import { MY_MESSAGES_CUES } from '../../utils/voice-cues.constants';

@Injectable()
export class MessageHandlerService {
  private readonly logger = new Logger(MessageHandlerService.name);
  private readonly symmetricTextEncryptor = new SymmetricTextEncryptor();

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prisma: PrismaService,
    private readonly fuzzySearchService: FuzzySearchService,
  ) {}

  async checkNewMessages(userId: number): Promise<ExecutionResult> {
    this.logger.log(`[checkNewMessages] Starting for user ${userId}`);

    try {
      const count = await this.prisma.message.count({
        where: {
          isDeleted: false,
          OR: [
            { recipientId: userId, status: 'SENT' },
            {
              DirectChat: {
                OR: [{ creatorId: userId }, { recipientId: userId }],
              },
              status: 'SENT',
            },
          ],
        },
      });

      this.logger.log(`[checkNewMessages] Found ${count} new messages`);

      const msg =
        count === 0
          ? 'Bạn không có tin nhắn mới nào.'
          : `Bạn có ${count} tin nhắn mới. Nói "đọc tin nhắn" để tôi đọc to.`;
      return { response: msg };
    } catch (err) {
      this.logger.warn(`[checkNewMessages] Error: ${(err as Error).message}`);
      return { response: 'Lỗi khi kiểm tra tin nhắn.' };
    }
  }

  async readLatestMessages(
    userId: number,
    contactName?: string,
    isMyMessages?: boolean,
    dateFilter?: string, // 'today' | 'yesterday' | 'last-week' | specific date
    messageCount?: number, // 10, 100, 200, etc.
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[readLatestMessages] Starting for user ${userId}, contactName: ${contactName || 'all'}, isMyMessages: ${isMyMessages}, dateFilter: ${dateFilter}, messageCount: ${messageCount}`,
    );

    try {
      let targetChatId: number | null = null;
      let targetGroupId: number | null = null;

      if (contactName) {
        this.logger.log(`[readLatestMessages] Finding contact: ${contactName}`);
        const contact = await this.fuzzySearchService.fuzzyFindContact(
          userId,
          contactName,
        );

        if (!contact) {
          this.logger.warn(
            `[readLatestMessages] Contact not found: ${contactName}`,
          );
          return {
            response: `Không tìm thấy ${contactName} trong danh sách liên hệ của bạn.`,
          };
        }

        this.logger.log(
          `[readLatestMessages] Found contact: ${contact.fullName}, type: ${contact.type}`,
        );
        if (contact.type === 'direct') {
          targetChatId = contact.directChatId ?? null;
        } else {
          targetGroupId = contact.groupId ?? null;
        }
      }

      const whereCondition: any = { isDeleted: false };

      // Build the base query conditions
      let baseCondition: any = {};

      // First, determine who can see which messages
      if (isMyMessages) {
        // Messages I sent
        baseCondition.authorId = userId;
      } else if (targetChatId) {
        // Messages from specific direct chat, but NOT from me
        baseCondition.directChatId = targetChatId;
        baseCondition.authorId = { not: userId };
      } else if (targetGroupId) {
        // Messages from specific group, but NOT from me
        baseCondition.groupChatId = targetGroupId;
        baseCondition.authorId = { not: userId };
      } else {
        // No specific contact: show all messages I received (not from me, in chats I'm in)
        baseCondition.AND = [
          { authorId: { not: userId } },
          {
            OR: [
              { recipientId: userId },
              {
                directChatId: { not: null },
                DirectChat: {
                  OR: [{ creatorId: userId }, { recipientId: userId }],
                },
              },
            ],
          },
        ];
      }

      // Merge base conditions with date filter
      Object.assign(whereCondition, baseCondition);

      // Apply date filter if provided
      if (dateFilter) {
        const now = new Date();
        let startDate: Date;

        switch (dateFilter.toLowerCase()) {
          case 'today':
            startDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            );
            whereCondition.createdAt = { gte: startDate };
            break;
          case 'yesterday':
            startDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate() - 1,
            );
            const endDate = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            );
            whereCondition.createdAt = { gte: startDate, lt: endDate };
            break;
          case 'last-week':
            startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            whereCondition.createdAt = { gte: startDate };
            break;
          default:
            // Try to parse specific date
            const parsedDate = new Date(dateFilter);
            if (!isNaN(parsedDate.getTime())) {
              startDate = new Date(
                parsedDate.getFullYear(),
                parsedDate.getMonth(),
                parsedDate.getDate(),
              );
              const nextDay = new Date(
                startDate.getTime() + 24 * 60 * 60 * 1000,
              );
              whereCondition.createdAt = { gte: startDate, lt: nextDay };
            }
        }
      }

      // Count total messages for list overview
      const totalCount = await this.prisma.message.count({
        where: whereCondition,
      });

      // Determine how many messages to fetch
      // Default: 10 messages
      // If asking for own messages (isMyMessages=true), default to 1 (just the latest one I sent)
      // Otherwise: can be overridden by messageCount parameter (any number like 10, 20, 100, 200, etc.)
      let limit = messageCount || (isMyMessages ? 1 : 10);

      let msgs = await this.prisma.message.findMany({
        where: whereCondition,
        include: {
          Author: { select: { Profile: { select: { fullName: true } } } },
          DirectChat: {
            include: {
              Creator: { select: { Profile: { select: { fullName: true } } } },
              Recipient: {
                select: { Profile: { select: { fullName: true } } },
              },
            },
          },
          GroupChat: { select: { name: true } },
          Media: { select: { type: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
      });

      if (!contactName && !targetChatId && !targetGroupId && !isMyMessages) {
        const userGroups = await this.prisma.groupChat.findMany({
          where: { Members: { some: { userId } } },
          select: { id: true },
        });

        const groupIds = userGroups.map((g) => g.id);

        if (groupIds.length > 0) {
          const groupMsgs = await this.prisma.message.findMany({
            where: {
              ...whereCondition,
              groupChatId: { in: groupIds },
              authorId: { not: userId },
            },
            include: {
              Author: { select: { Profile: { select: { fullName: true } } } },
              DirectChat: {
                include: {
                  Creator: {
                    select: { Profile: { select: { fullName: true } } },
                  },
                  Recipient: {
                    select: { Profile: { select: { fullName: true } } },
                  },
                },
              },
              GroupChat: { select: { name: true } },
              Media: { select: { type: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: limit,
          });

          msgs = [...msgs, ...groupMsgs];
          msgs.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
          msgs = msgs.slice(0, limit);
        }
      }

      this.logger.log(
        `[readLatestMessages] Found ${msgs.length} messages (total: ${totalCount})`,
      );

      if (msgs.length === 0) {
        return {
          response: isMyMessages
            ? 'Bạn chưa gửi tin nhắn nào.'
            : 'Bạn chưa có tin nhắn nào.',
        };
      }

      let speech = '';

      // Build the intro message based on parameters
      if (isMyMessages) {
        speech = `Tin nhắn bạn vừa gửi: `;
      } else if (contactName) {
        speech = `Danh sách tin nhắn từ ${contactName}. `;
      } else if (dateFilter) {
        speech = `Tin nhắn vào ${this.formatDateFilterText(dateFilter)}. `;
      } else if (messageCount && messageCount > 0) {
        // Show message count in intro if explicitly requested
        speech = `${messageCount} tin nhắn mới nhất. `;
      } else {
        speech = 'Tin nhắn mới nhất. ';
      }

      for (const m of msgs.reverse()) {
        const senderName = m.Author?.Profile?.fullName || 'Ai đó';

        // Get recipient info for "isMyMessages" case
        let recipientInfo = '';
        if (isMyMessages) {
          if (m.DirectChat) {
            // For direct chat, get the other person's name
            const recipientName =
              m.DirectChat.creatorId === userId
                ? m.DirectChat.Recipient?.Profile?.fullName
                : m.DirectChat.Creator?.Profile?.fullName;
            recipientInfo = recipientName ? ` gửi cho ${recipientName}` : '';
          } else if (m.GroupChat) {
            // For group chat
            recipientInfo = ` vào nhóm ${m.GroupChat.name}`;
          }
        }

        // Format time
        const messageTime = new Date(m.createdAt);
        const timeStr = messageTime.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        });

        try {
          // Check message type and format accordingly
          let messageContent = '';

          if (m.type === 'STICKER') {
            messageContent = 'gửi sticker';
          } else if (m.type === 'MEDIA') {
            // For media, check the actual media type
            if (m.Media?.type === 'IMAGE') {
              messageContent = 'gửi ảnh';
            } else if (m.Media?.type === 'VIDEO') {
              messageContent = 'gửi video';
            } else if (m.Media?.type === 'AUDIO') {
              messageContent = 'gửi voice';
            } else if (m.Media?.type === 'DOCUMENT') {
              messageContent = 'gửi file';
            } else {
              messageContent = 'gửi file';
            }
          } else {
            // TEXT or other types - decrypt and show content
            const decryptedContent = await this.decryptContent(
              m.content,
              m.dek,
            );
            messageContent = decryptedContent;
          }

          if (isMyMessages) {
            speech += `Vào lúc ${timeStr}${recipientInfo}: ${messageContent}. `;
          } else {
            speech += `${senderName} vào lúc ${timeStr}: ${messageContent}. `;
          }
        } catch (err) {
          this.logger.warn(
            `[readLatestMessages] Failed to process message ${m.id}`,
          );
          if (isMyMessages) {
            speech += `Vào lúc ${timeStr}${recipientInfo}: [Không thể giải mã]. `;
          } else {
            speech += `${senderName} vào lúc ${timeStr}: [Không thể giải mã]. `;
          }
        }
      }

      return { response: speech || 'Bạn chưa có tin nhắn nào.' };
    } catch (err) {
      this.logger.warn(
        `[readLatestMessages] Fatal error: ${(err as Error).message}`,
      );
      return { response: 'Lỗi khi đọc tin nhắn.' };
    }
  }

  async readLatestMessagesById(
    userId: number,
    contactId?: number,
    isMyMessages?: boolean,
    dateFilter?: string,
    messageCount?: number,
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[readLatestMessagesById] user=${userId}, contactId=${contactId}, isMyMessages=${isMyMessages}, dateFilter=${dateFilter}, messageCount=${messageCount}`,
    );

    if (!contactId && !isMyMessages) {
      return await this.readLatestMessages(
        userId,
        undefined,
        false,
        dateFilter,
        messageCount,
      );
    }

    if (isMyMessages) {
      return await this.readLatestMessages(
        userId,
        undefined,
        true,
        dateFilter,
        messageCount,
      );
    }

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
      const contactName = otherUser?.Profile?.fullName || 'Unknown';
      return await this.readLatestMessages(
        userId,
        contactName,
        false,
        dateFilter,
        messageCount,
      );
    }

    const groupChat = await this.prisma.groupChat.findUnique({
      where: { id: contactId },
    });

    if (groupChat) {
      return await this.readLatestMessages(
        userId,
        groupChat.name,
        false,
        dateFilter,
        messageCount,
      );
    }

    return { response: 'Không tìm thấy đoạn chat.' };
  }

  async prepareSendMessage(
    userId: number,
    params: { contactName: string; content: string },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareSendMessage] user=${userId}, contact=${params.contactName}`,
    );

    const contact = await this.fuzzySearchService.fuzzyFindContact(
      userId,
      params.contactName,
    );

    if (!contact) {
      return {
        response: `Không tìm thấy ${params.contactName} trong danh sách bạn bè hoặc group của bạn.`,
      };
    }

    if (contact.type === 'group') {
      const confirmationMessage = `Gửi vào group ${contact.fullName}: "${params.content}". Xác nhận gửi không? Nói "có" để gửi.`;
      return {
        response: confirmationMessage,
        pending: {
          type: 'send_message',
          targetId: contact.groupId,
          targetName: contact.fullName,
          content: params.content,
          lastBotMessage: confirmationMessage,
          chatType: 'group',
        } as any,
      };
    }

    const confirmationMessage = `Gửi cho ${contact.fullName}: "${params.content}". Xác nhận gửi không? Nói "có" để gửi.`;
    return {
      response: confirmationMessage,
      pending: {
        type: 'send_message',
        targetId: contact.directChatId || 0,
        targetName: contact.fullName,
        content: params.content,
        lastBotMessage: confirmationMessage,
        chatType: 'direct',
      } as any,
    };
  }

  async prepareSendMessageById(
    userId: number,
    params: { contactId?: string; contactType?: string; content: string },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareSendMessageById] user=${userId}, contactId=${params.contactId}, contactType=${params.contactType}`,
    );

    if (!params.contactId) {
      return {
        response: 'Không tìm thấy liên hệ. Vui lòng nói tên người nhận.',
      };
    }

    const contactId = parseInt(params.contactId);

    // Check based on contactType if provided
    if (params.contactType === 'group') {
      const groupChat = await this.prisma.groupChat.findUnique({
        where: { id: contactId },
      });

      if (groupChat) {
        const confirmationMessage = `Gửi vào group ${groupChat.name}: "${params.content}". Xác nhận không? Nói "có" để gửi.`;
        return {
          response: confirmationMessage,
          pending: {
            type: 'send_message',
            targetId: groupChat.id,
            targetName: groupChat.name,
            content: params.content,
            lastBotMessage: confirmationMessage,
            chatType: 'group',
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
        const recipientUserId =
          directChat.recipientId === userId
            ? directChat.creatorId
            : directChat.recipientId;

        const confirmationMessage = `Gửi cho ${targetName}: "${params.content}". Xác nhận không? Nói "có" để gửi.`;
        return {
          response: confirmationMessage,
          pending: {
            type: 'send_message',
            targetId: directChat.id,
            targetName,
            content: params.content,
            lastBotMessage: confirmationMessage,
            chatType: 'direct',
            recipientUserId,
          } as any,
        };
      }
    } else {
      // Fallback: Try DirectChat first (more common), then GroupChat
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
        const recipientUserId =
          directChat.recipientId === userId
            ? directChat.creatorId
            : directChat.recipientId;

        const confirmationMessage = `Gửi cho ${targetName}: "${params.content}". Xác nhận không? Nói "có" để gửi.`;
        return {
          response: confirmationMessage,
          pending: {
            type: 'send_message',
            targetId: directChat.id,
            targetName,
            content: params.content,
            lastBotMessage: confirmationMessage,
            chatType: 'direct',
            recipientUserId,
          } as any,
        };
      }

      const groupChat = await this.prisma.groupChat.findUnique({
        where: { id: contactId },
      });

      if (groupChat) {
        const confirmationMessage = `Gửi vào group ${groupChat.name}: "${params.content}". Xác nhận không? Nói "có" để gửi.`;
        return {
          response: confirmationMessage,
          pending: {
            type: 'send_message',
            targetId: groupChat.id,
            targetName: groupChat.name,
            content: params.content,
            lastBotMessage: confirmationMessage,
            chatType: 'group',
          } as any,
        };
      }
    }

    return {
      response: 'Không tìm thấy liên hệ. Vui lòng thử lại.',
    };
  }

  async prepareSendVoiceMessageById(
    userId: number,
    params: { contactId?: string; contactType?: string },
    audioBase64?: string,
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareSendVoiceMessageById] user=${userId}, contactId=${params.contactId}`,
    );

    if (!audioBase64 || audioBase64.trim().length === 0) {
      return { response: 'Không có dữ liệu âm thanh. Vui lòng thử lại.' };
    }

    if (!params.contactId) {
      return {
        response:
          'Không tìm thấy liên hệ. Vui lòng nói tên người nhận tin nhắn voice.',
      };
    }

    const contactId = parseInt(params.contactId);

    // Check based on contactType if provided
    if (params.contactType === 'group') {
      const groupChat = await this.prisma.groupChat.findUnique({
        where: { id: contactId },
      });

      if (groupChat) {
        const confirmationMessage = `Gửi tin nhắn voice vào group ${groupChat.name}. Xác nhận không? Nói "có" để gửi.`;
        return {
          response: confirmationMessage,
          pending: {
            type: 'send_voice_message',
            targetId: groupChat.id,
            groupId: groupChat.id,
            targetName: groupChat.name,
            content: 'voice_message',
            lastBotMessage: confirmationMessage,
            audioBase64,
            chatType: 'group',
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
        const recipientUserId =
          directChat.recipientId === userId
            ? directChat.creatorId
            : directChat.recipientId;

        const confirmationMessage = `Gửi tin nhắn voice cho ${targetName}. Xác nhận không? Nói "có" để gửi.`;
        return {
          response: confirmationMessage,
          pending: {
            type: 'send_voice_message',
            targetId: directChat.id,
            directChatId: directChat.id,
            targetName,
            content: 'voice_message',
            lastBotMessage: confirmationMessage,
            audioBase64,
            chatType: 'direct',
            recipientUserId,
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
        const recipientUserId =
          directChat.recipientId === userId
            ? directChat.creatorId
            : directChat.recipientId;

        const confirmationMessage = `Gửi tin nhắn voice cho ${targetName}. Xác nhận không? Nói "có" để gửi.`;
        return {
          response: confirmationMessage,
          pending: {
            type: 'send_voice_message',
            targetId: directChat.id,
            directChatId: directChat.id,
            targetName,
            content: 'voice_message',
            lastBotMessage: confirmationMessage,
            audioBase64,
            chatType: 'direct',
            recipientUserId,
          } as any,
        };
      }

      const groupChat = await this.prisma.groupChat.findUnique({
        where: { id: contactId },
      });

      if (groupChat) {
        const confirmationMessage = `Gửi tin nhắn voice vào group ${groupChat.name}. Xác nhận không? Nói "có" để gửi.`;
        return {
          response: confirmationMessage,
          pending: {
            type: 'send_voice_message',
            targetId: groupChat.id,
            groupId: groupChat.id,
            targetName: groupChat.name,
            content: 'voice_message',
            lastBotMessage: confirmationMessage,
            audioBase64,
            chatType: 'group',
          } as any,
        };
      }
    }

    return {
      response: 'Không tìm thấy liên hệ. Vui lòng thử lại.',
    };
  }

  async prepareSendImageById(
    userId: number,
    params: { contactId?: string },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareSendImageById] user=${userId}, contactId=${params.contactId}`,
    );

    if (!params.contactId) {
      return {
        response:
          'Không tìm thấy liên hệ. Vui lòng nói tên người bạn muốn gửi ảnh.',
      };
    }

    const contactId = parseInt(params.contactId);
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
      const confirmationMessage = `Gửi ảnh cho ${targetName}. Xác nhận không? Nói "có" để gửi.`;
      return {
        response: confirmationMessage,
        pending: {
          type: 'send_image',
          targetId: directChat.id,
          targetName,
          content: 'image',
          lastBotMessage: confirmationMessage,
          chatType: 'direct',
          directChatId: directChat.id,
        } as any,
      };
    }

    const groupChat = await this.prisma.groupChat.findUnique({
      where: { id: contactId },
    });

    if (groupChat) {
      const confirmationMessage = `Gửi ảnh vào group ${groupChat.name}. Xác nhận không? Nói "có" để gửi.`;
      return {
        response: confirmationMessage,
        pending: {
          type: 'send_image',
          targetId: groupChat.id,
          targetName: groupChat.name,
          content: 'image',
          lastBotMessage: confirmationMessage,
          chatType: 'group',
          groupId: groupChat.id,
        } as any,
      };
    }

    return { response: 'Không tìm thấy liên hệ. Vui lòng thử lại.' };
  }

  async prepareSendDocumentById(
    userId: number,
    params: { contactId?: string },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareSendDocumentById] user=${userId}, contactId=${params.contactId}`,
    );

    if (!params.contactId) {
      return {
        response:
          'Không tìm thấy liên hệ. Vui lòng nói tên người bạn muốn gửi tài liệu.',
      };
    }

    const contactId = parseInt(params.contactId);
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
      const confirmationMessage = `Gửi tài liệu cho ${targetName}. Xác nhận không? Nói "có" để gửi.`;
      return {
        response: confirmationMessage,
        pending: {
          type: 'send_document',
          targetId: directChat.id,
          targetName,
          content: 'document',
          lastBotMessage: confirmationMessage,
          chatType: 'direct',
          directChatId: directChat.id,
        } as any,
      };
    }

    const groupChat = await this.prisma.groupChat.findUnique({
      where: { id: contactId },
    });

    if (groupChat) {
      const confirmationMessage = `Gửi tài liệu vào group ${groupChat.name}. Xác nhận không? Nói "có" để gửi.`;
      return {
        response: confirmationMessage,
        pending: {
          type: 'send_document',
          targetId: groupChat.id,
          targetName: groupChat.name,
          content: 'document',
          lastBotMessage: confirmationMessage,
          chatType: 'group',
          groupId: groupChat.id,
        } as any,
      };
    }

    return { response: 'Không tìm thấy liên hệ. Vui lòng thử lại.' };
  }

  async prepareSearchMessage(
    userId: number,
    params: { searchKeyword: string },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareSearchMessage] user=${userId}, keyword=${params.searchKeyword}`,
    );

    if (!params.searchKeyword || params.searchKeyword.trim().length === 0) {
      return {
        response: 'Bạn muốn tìm gì? Vui lòng nói từ khóa tìm kiếm.',
      };
    }

    const confirmationMessage = `Tìm kiếm tin nhắn chứa "${params.searchKeyword}". Xác nhận không? Nói "có" để tìm.`;
    return {
      response: confirmationMessage,
      pending: {
        type: 'search_message',
        targetId: userId,
        targetName: 'Search',
        content: params.searchKeyword,
        lastBotMessage: confirmationMessage,
      } as any,
    };
  }

  async prepareSearchSmart(
    userId: number,
    params: { searchKeyword: string },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareSearchSmart] user=${userId}, keyword=${params.searchKeyword}`,
    );

    if (!params.searchKeyword || params.searchKeyword.trim().length === 0) {
      return {
        response: 'Bạn muốn tìm gì? Vui lòng nói từ khóa tìm kiếm thông minh.',
      };
    }

    const confirmationMessage = `Bạn muốn tìm kiếm thông minh với từ khóa "${params.searchKeyword}", đúng không?`;
    return {
      response: confirmationMessage,
      pending: {
        type: 'search_smart',
        targetId: userId,
        targetName: 'Tìm kiếm thông minh',
        content: params.searchKeyword,
        lastBotMessage: confirmationMessage,
      } as any,
    };
  }

  async sendGroupMessage(
    groupChatId: number,
    content: string,
    fromUserId: number,
  ): Promise<void> {
    this.logger.log(
      `[sendGroupMessage] group=${groupChatId}, from=${fromUserId}`,
    );
    this.logger.log(
      `[sendGroupMessage] Skipping DB write; frontend handles message send`,
    );
    // Message creation is handled by frontend via message service API
  }

  async sendDirectMessage(
    directChatId: number,
    content: string,
    fromUserId: number,
  ): Promise<void> {
    this.logger.log(
      `[sendDirectMessage] chat=${directChatId}, from=${fromUserId}`,
    );
    this.logger.log(
      `[sendDirectMessage] Skipping DB write; frontend handles message send`,
    );
    // Message creation is handled by frontend via message service API
  }

  async sendGroupVoiceMessage(
    groupChatId: number,
    audioBase64: string,
    fromUserId: number,
  ): Promise<any> {
    this.logger.log(`[sendGroupVoiceMessage] group=${groupChatId}`);
    this.logger.log(
      `[sendGroupVoiceMessage] Skipping DB write; frontend handles voice send`,
    );
    return {
      forwardedToClient: true,
      clientAction: {
        type: 'send_voice_message',
        chatType: 'group',
        groupChatId,
      },
    };
  }

  async sendDirectVoiceMessage(
    directChatId: number,
    audioBase64: string,
    fromUserId: number,
  ): Promise<any> {
    this.logger.log(`[sendDirectVoiceMessage] chat=${directChatId}`);
    this.logger.log(
      `[sendDirectVoiceMessage] Skipping DB write; frontend handles voice send`,
    );
    return {
      forwardedToClient: true,
      clientAction: {
        type: 'send_voice_message',
        chatType: 'direct',
        directChatId,
      },
    };
  }

  private async decryptContent(
    encryptedContent: string,
    encryptedDek?: string,
  ): Promise<string> {
    if (!encryptedContent) return '[Sticker]';
    if (!encryptedDek) return '[Thiếu DEK]';

    const secretKey = process.env.MESSAGES_ENCRYPTION_SECRET_KEY;
    if (!secretKey) return '[Lỗi mã hóa hệ thống]';

    const dek = this.symmetricTextEncryptor.decrypt(encryptedDek, secretKey);
    return this.symmetricTextEncryptor.decrypt(encryptedContent, dek);
  }

  /**
   * Convert dateFilter to readable Vietnamese text
   */
  private formatDateFilterText(dateFilter: string): string {
    switch (dateFilter?.toLowerCase()) {
      case 'today':
        return 'hôm nay';
      case 'yesterday':
        return 'hôm qua';
      case 'last-week':
        return 'tuần qua';
      default:
        // Try to parse date
        try {
          const date = new Date(dateFilter);
          if (!isNaN(date.getTime())) {
            return date.toLocaleDateString('vi-VN');
          }
        } catch (e) {
          // ignore
        }
        return dateFilter || 'gần đây';
    }
  }
}
