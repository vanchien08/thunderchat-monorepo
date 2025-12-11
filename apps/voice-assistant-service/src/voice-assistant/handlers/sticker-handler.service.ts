// src/voice-assistant/handlers/sticker-handler.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@/configs/db/prisma.service';
import { EProviderTokens } from '@/utils/enums';
import {
  EMOTION_TO_CATEGORY_MAP,
  getEmotionKeywords,
} from '../../utils/emotion-mapping';
import { ExecutionResult } from '../voice-assistant.interface';
import { LlmService } from '../services/llm.service';

@Injectable()
export class StickerHandlerService {
  private readonly logger = new Logger(StickerHandlerService.name);

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prisma: PrismaService,
    private readonly llmService: LlmService,
  ) {}

  async searchStickerByEmotion(
    emotion: string,
    limit: number = 5,
  ): Promise<any[]> {
    this.logger.log(`[searchStickerByEmotion] emotion="${emotion}"`);

    // Normalize emotion using LLM if exact match not found
    let normalizedEmotion = emotion.toLowerCase().trim();
    const exactMatch = getEmotionKeywords(normalizedEmotion);

    if (
      exactMatch[0] === normalizedEmotion &&
      !EMOTION_TO_CATEGORY_MAP[normalizedEmotion]
    ) {
      // If no exact match, use LLM to correct the emotion
      try {
        this.logger.log(
          `[searchStickerByEmotion] No exact match for "${emotion}", using LLM to normalize...`,
        );
        const llmNormalized = await this.llmService.normalizeEmotion(emotion);
        if (llmNormalized && llmNormalized !== emotion) {
          this.logger.log(
            `[searchStickerByEmotion] LLM corrected "${emotion}" → "${llmNormalized}"`,
          );
          normalizedEmotion = llmNormalized.toLowerCase().trim();
        }
      } catch (error) {
        this.logger.warn(
          `[searchStickerByEmotion] LLM normalization failed: ${error.message}`,
        );
      }
    }

    const matchedKeywords = getEmotionKeywords(normalizedEmotion);

    this.logger.log(
      `[searchStickerByEmotion] keywords: ${matchedKeywords.join(', ')}`,
    );

    const categories = await this.prisma.stickerCategory.findMany();
    this.logger.log(
      `[searchStickerByEmotion] Total categories in DB: ${categories.length}`,
    );

    // Log tất cả categories để debug
    if (categories.length > 0) {
      this.logger.log(
        `[searchStickerByEmotion] Sample categories: ${categories
          .slice(0, 5)
          .map((c) => `${c.name}(${c.idName})`)
          .join(', ')}`,
      );
    }

    const matchedCategories = categories.filter((cat) =>
      matchedKeywords.some(
        (keyword) =>
          cat.name.toLowerCase().includes(keyword) ||
          cat.idName.toLowerCase().includes(keyword),
      ),
    );

    this.logger.log(
      `[searchStickerByEmotion] Matched categories: ${matchedCategories.length}`,
    );

    if (matchedCategories.length === 0) {
      this.logger.log(
        `[searchStickerByEmotion] No category match, searching by stickerName with "${normalizedEmotion}"`,
      );

      // First try exact/contains search
      const stickersByName = await this.prisma.sticker.findMany({
        where: {
          stickerName: {
            contains: normalizedEmotion,
            mode: 'insensitive',
          },
        },
        take: limit,
      });

      this.logger.log(
        `[searchStickerByEmotion] Found ${stickersByName.length} stickers by exact name match`,
      );

      if (stickersByName.length > 0) {
        return stickersByName;
      }

      // If no exact match, use LLM to find best matching sticker
      this.logger.log(
        `[searchStickerByEmotion] No exact name match, using LLM to find best sticker...`,
      );

      const allStickers = await this.prisma.sticker.findMany({
        take: limit * 5, // Get more candidates for LLM to choose from
      });

      if (allStickers.length === 0) {
        this.logger.log(`[searchStickerByEmotion] No stickers in database`);
        return [];
      }

      try {
        const stickerList = allStickers
          .map((s, idx) => `${idx + 1}. ${s.stickerName} (ID: ${s.id})`)
          .join('\n');

        const llmPrompt = `Given the emotion/keyword "${normalizedEmotion}", pick the BEST matching sticker(s) from this list. Return only the sticker indices (numbers) that best match, separated by commas. If no good match, return empty string.

Available stickers:
${stickerList}

Example response: "2, 5, 7"`;

        const llmResponse = await this.llmService.callLLMForSticker(llmPrompt);
        this.logger.log(
          `[searchStickerByEmotion] LLM response: "${llmResponse}"`,
        );

        // Parse LLM response to get indices
        const indices = llmResponse
          .split(',')
          .map((idx) => parseInt(idx.trim()) - 1) // Convert to 0-based index
          .filter((idx) => idx >= 0 && idx < allStickers.length);

        if (indices.length > 0) {
          const selectedStickers = indices.map((idx) => allStickers[idx]);
          this.logger.log(
            `[searchStickerByEmotion] Found ${selectedStickers.length} stickers via LLM`,
          );
          return selectedStickers;
        }
      } catch (error) {
        this.logger.warn(
          `[searchStickerByEmotion] LLM sticker selection failed: ${error.message}`,
        );
      }

      // Fallback: use fuzzy search if LLM fails
      this.logger.log(
        `[searchStickerByEmotion] Falling back to fuzzy search...`,
      );
      const scoredStickers = allStickers
        .map((sticker) => ({
          sticker,
          score: this.calculateStringSimilarity(
            normalizedEmotion,
            sticker.stickerName.toLowerCase(),
          ),
        }))
        .filter((item) => item.score >= 0.4) // Lower threshold for fallback
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((item) => item.sticker);

      this.logger.log(
        `[searchStickerByEmotion] Found ${scoredStickers.length} stickers by fuzzy match`,
      );
      return scoredStickers;
    }

    const stickers = await this.prisma.sticker.findMany({
      where: {
        categoryId: {
          in: matchedCategories.map((c) => c.id),
        },
      },
      take: limit,
      orderBy: { id: 'asc' },
    });

    this.logger.log(
      `[searchStickerByEmotion] Found ${stickers.length} stickers from matched categories`,
    );
    return stickers;
  }

  async prepareSendSticker(
    userId: number,
    params: {
      contactId?: string;
      contactType?: string;
      stickerEmotion: string;
    },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareSendSticker] user=${userId}, emotion=${params.stickerEmotion}`,
    );

    if (!params.stickerEmotion || params.stickerEmotion.trim().length === 0) {
      return {
        response:
          'Bạn muốn gửi sticker gì? Nói rõ cảm xúc như cười, khóc, yêu, buồn, vui.',
      };
    }

    if (!params.contactId) {
      return {
        response:
          'Không tìm thấy liên hệ. Vui lòng nói tên người bạn muốn gửi sticker.',
      };
    }

    const stickers = await this.searchStickerByEmotion(
      params.stickerEmotion,
      5,
    );

    if (stickers.length === 0) {
      return {
        response: `Không tìm thấy sticker nào về ${params.stickerEmotion}. Thử từ khóa khác như cười, khóc, yêu, vui, buồn.`,
      };
    }

    const bestSticker = stickers[0];
    const contactId = parseInt(params.contactId);

    // Check based on contactType if provided
    if (params.contactType === 'group') {
      const groupChat = await this.prisma.groupChat.findUnique({
        where: { id: contactId },
      });

      if (groupChat) {
        const stickerDescription = bestSticker.stickerName || 'sticker';
        const confirmationMessage = `Gửi sticker ${stickerDescription} vào group ${groupChat.name}. Xác nhận không? Nói "có" để gửi.`;

        return {
          response: confirmationMessage,
          pending: {
            type: 'send_sticker',
            targetId: groupChat.id,
            targetName: groupChat.name,
            content: 'sticker',
            lastBotMessage: confirmationMessage,
            stickerId: bestSticker.id,
            stickerDescription,
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
        const otherUserId =
          directChat.creatorId === userId
            ? directChat.recipientId
            : directChat.creatorId;
        const targetName = otherUser?.Profile?.fullName || 'Unknown';
        const stickerDescription = bestSticker.stickerName || 'sticker';
        const confirmationMessage = `Gửi sticker ${stickerDescription} cho ${targetName}. Xác nhận không? Nói "có" để gửi.`;

        return {
          response: confirmationMessage,
          pending: {
            type: 'send_sticker',
            targetId: directChat.id,
            targetName,
            content: 'sticker',
            lastBotMessage: confirmationMessage,
            stickerId: bestSticker.id,
            stickerDescription,
            chatType: 'direct',
            directChatId: directChat.id,
            recipientUserId: otherUserId,
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
        const otherUserId =
          directChat.creatorId === userId
            ? directChat.recipientId
            : directChat.creatorId;
        const targetName = otherUser?.Profile?.fullName || 'Unknown';
        const stickerDescription = bestSticker.stickerName || 'sticker';
        const confirmationMessage = `Gửi sticker ${stickerDescription} cho ${targetName}. Xác nhận không? Nói "có" để gửi.`;

        return {
          response: confirmationMessage,
          pending: {
            type: 'send_sticker',
            targetId: directChat.id,
            targetName,
            content: 'sticker',
            lastBotMessage: confirmationMessage,
            stickerId: bestSticker.id,
            stickerDescription,
            chatType: 'direct',
            directChatId: directChat.id,
            recipientUserId: otherUserId,
          } as any,
        };
      }

      const groupChat = await this.prisma.groupChat.findUnique({
        where: { id: contactId },
      });

      if (groupChat) {
        const stickerDescription = bestSticker.stickerName || 'sticker';
        const confirmationMessage = `Gửi sticker ${stickerDescription} vào group ${groupChat.name}. Xác nhận không? Nói "có" để gửi.`;

        return {
          response: confirmationMessage,
          pending: {
            type: 'send_sticker',
            targetId: groupChat.id,
            targetName: groupChat.name,
            content: 'sticker',
            lastBotMessage: confirmationMessage,
            stickerId: bestSticker.id,
            stickerDescription,
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

  async reallySendSticker(
    targetChatId: number,
    stickerId: number,
    userId: number,
    chatType: 'direct' | 'group',
  ): Promise<void> {
    this.logger.log(
      `[reallySendSticker] chat=${targetChatId}, sticker=${stickerId}`,
    );

    // Note: Message creation is handled by frontend/other service
    // Backend only confirms the sticker send action
    this.logger.log(
      `[reallySendSticker] ✅ Sticker send confirmed for stickerId=${stickerId}`,
    );
  }

  /**
   * Calculate string similarity using Levenshtein distance (0-1 score)
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const maxLen = Math.max(str1.length, str2.length);
    if (maxLen === 0) return 1; // Both empty
    const distance = this.levenshteinDistance(str1, str2);
    return 1 - distance / maxLen;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const m = str1.length;
    const n = str2.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () =>
      Array(n + 1).fill(0),
    );

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]) + 1;
        }
      }
    }

    return dp[m][n];
  }
}
