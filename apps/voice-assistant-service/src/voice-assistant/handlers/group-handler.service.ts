// src/voice-assistant/handlers/group-handler.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@/configs/db/prisma.service';
import { EProviderTokens } from '@/utils/enums';
import { FuzzySearchService } from '../../utils/fuzzy-search.service';
import { LlmService } from '../services/llm.service';
import { ExecutionResult } from '../voice-assistant.interface';

@Injectable()
export class GroupHandlerService {
  private readonly logger = new Logger(GroupHandlerService.name);

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prisma: PrismaService,
    private readonly fuzzySearchService: FuzzySearchService,
    private readonly llmService: LlmService,
  ) {}

  async prepareCreateGroup(
    userId: number,
    params: { groupName: string; memberNames: string[] },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareCreateGroup] user=${userId}, group=${params.groupName}`,
    );

    // Default group name if not provided
    if (!params.groupName || params.groupName.trim().length === 0) {
      params.groupName = 'New Group';
      this.logger.log(
        `[prepareCreateGroup] No group name provided, defaulting to: ${params.groupName}`,
      );
    }

    if (params.groupName.length > 100) {
      return {
        response: 'Tên nhóm quá dài. Vui lòng đặt tên ngắn hơn.',
      };
    }

    if (!params.memberNames || params.memberNames.length === 0) {
      return {
        response:
          'Nhóm cần có ít nhất 1 thành viên. Vui lòng nói tên các thành viên.',
      };
    }

    const memberIds: number[] = [];
    const notFoundMembers: string[] = [];
    const selfAliases = new Set(['tôi', 'mình', 'tui', 'tao', 'tớ', 'ta']);
    const asciiSelfAliases = new Set(['toi', 'minh', 'tui', 'tao', 'to', 'ta']);
    const toAscii = (s: string) =>
      s
        .normalize('NFD')
        .replace(/\p{Diacritic}+/gu, '')
        .toLowerCase();
    const squeezeRepeats = (s: string) => s.replace(/(.)\1+/g, '$1');

    for (const memberName of params.memberNames) {
      this.logger.log(`[prepareCreateGroup] Looking for: ${memberName}`);

      const norm = memberName.toLowerCase().trim();
      const ascii = toAscii(norm);
      if (
        selfAliases.has(norm) ||
        asciiSelfAliases.has(ascii) ||
        squeezeRepeats(ascii) === 'toi'
      ) {
        if (!memberIds.includes(userId)) {
          memberIds.push(userId);
        }
        this.logger.log(
          `[prepareCreateGroup] Using self alias matched: ${memberName} -> userId ${userId}`,
        );
        continue;
      }

      // LLM fallback to detect self pronoun for noisy ASR like "tooi"
      try {
        const isSelf = await this.llmService.isSelfPronoun(memberName);
        if (isSelf) {
          if (!memberIds.includes(userId)) {
            memberIds.push(userId);
          }
          this.logger.log(
            `[prepareCreateGroup] LLM detected self pronoun: ${memberName} -> userId ${userId}`,
          );
          continue;
        }
      } catch (e) {
        this.logger.warn(
          `[prepareCreateGroup] LLM self detection failed for "${memberName}": ${(e as Error).message}`,
        );
      }

      const contact = await this.fuzzySearchService.fuzzyFindContact(
        userId,
        memberName,
      );

      if (contact && contact.type === 'direct' && contact.directChatId) {
        const directChat = await this.prisma.directChat.findUnique({
          where: { id: contact.directChatId },
        });
        if (directChat) {
          const friendId =
            directChat.creatorId === userId
              ? directChat.recipientId
              : directChat.creatorId;
          if (!memberIds.includes(friendId)) {
            memberIds.push(friendId);
          }
          this.logger.log(
            `[prepareCreateGroup] Found: ${memberName} (ID: ${friendId})`,
          );
        } else {
          notFoundMembers.push(memberName);
        }
      } else {
        notFoundMembers.push(memberName);
      }
    }

    if (notFoundMembers.length > 0) {
      return {
        response: `Không tìm thấy: ${notFoundMembers.join(', ')}. Vui lòng kiểm tra lại tên.`,
      };
    }

    if (!memberIds.includes(userId)) {
      memberIds.push(userId);
    }

    if (memberIds.length < 2) {
      return {
        response: 'Nhóm phải có ít nhất 2 người. Vui lòng thêm thành viên.',
      };
    }

    if (memberIds.length > 50) {
      return {
        response:
          'Nhóm không thể có quá 50 người. Vui lòng giảm số lượng thành viên.',
      };
    }

    const memberNamesStr = params.memberNames.join(', ');
    const confirmationMessage = `Tạo nhóm "${params.groupName}" với ${memberIds.length} thành viên: ${memberNamesStr}. Xác nhận không? Nói "có" để tạo.`;
    this.logger.log(
      `[prepareCreateGroup] Computed memberIds for frontend: ${JSON.stringify(memberIds)}`,
    );
    console.log('check id member>>>', memberIds);
    return {
      response: confirmationMessage,
      pending: {
        type: 'create_group',
        targetId: userId,
        targetName: 'Group',
        content: params.groupName,
        groupName: params.groupName,
        memberIds,
        memberNames: params.memberNames,
        lastBotMessage: confirmationMessage,
      } as any,
    };
  }

  async reallyCreateGroup(
    userId: number,
    groupName: string,
    memberIds: number[],
  ): Promise<string> {
    this.logger.log(
      `[reallyCreateGroup] Delegated to frontend. group="${groupName}", members=${memberIds.length}`,
    );
    // Không tạo nhóm ở backend nữa. Frontend sẽ gọi API của chính nó.
    // Giữ method để tương thích nhưng chỉ phản hồi trạng thái.
    return `Đã nhận yêu cầu tạo nhóm. Frontend sẽ tạo nhóm "${groupName}" với ${memberIds.length} thành viên.`;
  }

  /**
   * Calculate string similarity using Levenshtein distance
   * Returns value between 0-1
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    if (maxLen === 0) return 1.0; // Both empty

    // Substring match is highest priority
    if (str1.includes(str2) || str2.includes(str1)) {
      return 1.0;
    }

    // Calculate Levenshtein distance
    const distance = this.levenshteinDistance(str1, str2);
    return Math.max(0, 1 - distance / maxLen);
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    const dp: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1,
            dp[i][j - 1] + 1,
            dp[i - 1][j - 1] + 1,
          );
        }
      }
    }

    return dp[len1][len2];
  }

  async prepareInviteToGroup(
    userId: number,
    params: { groupName?: string; memberNames?: string[] },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareInviteToGroup] user=${userId}, groupName=${params.groupName}`,
    );

    if (!params.groupName || params.groupName.trim().length === 0) {
      return {
        response: 'Cần biết tên nhóm để mời thành viên. Vui lòng nói tên nhóm.',
      };
    }

    if (!params.memberNames || params.memberNames.length === 0) {
      return {
        response:
          'Cần biết tên thành viên để mời. Vui lòng nói tên người dùng.',
      };
    }

    // Fuzzy search for group by name
    const allGroups = await this.prisma.groupChat.findMany({ take: 100 });
    let foundGroup: (typeof allGroups)[0] | null = null;
    let bestScore = -1;

    const searchTerm = params.groupName.toLowerCase().trim();

    for (const group of allGroups) {
      const groupName = group.name.toLowerCase();

      // Check exact substring match first (highest priority)
      if (groupName.includes(searchTerm) || searchTerm.includes(groupName)) {
        const score = 1.0;
        this.logger.log(
          `[prepareInviteToGroup] Exact substring match: "${searchTerm}" in "${group.name}"`,
        );
        foundGroup = group;
        bestScore = score;
        break; // Take first substring match
      }
    }

    // If no substring match, try fuzzy matching (case insensitive)
    if (!foundGroup) {
      for (const group of allGroups) {
        const groupName = group.name.toLowerCase();
        // Levenshtein-like fuzzy match: calculate edit distance ratio
        const similarity = this.calculateStringSimilarity(
          searchTerm,
          groupName,
        );

        this.logger.log(
          `[prepareInviteToGroup] Fuzzy match: "${searchTerm}" vs "${group.name}" - similarity: ${(similarity * 100).toFixed(1)}%`,
        );

        if (similarity > bestScore) {
          bestScore = similarity;
          foundGroup = group;
        }
      }
    }

    // Accept matches with similarity >= 0.6
    if (!foundGroup || bestScore < 0.6) {
      this.logger.log(
        `[prepareInviteToGroup] Group not found: ${params.groupName} (best score: ${bestScore})`,
      );
      return {
        response: `Không tìm thấy nhóm "${params.groupName}". Vui lòng thử lại.`,
      };
    }

    this.logger.log(
      `[prepareInviteToGroup] Found group: ${foundGroup.name} (score: ${bestScore})`,
    );

    // Fuzzy search for members using fuzzyFindContact
    const memberIds: number[] = [];
    const foundMemberNames: string[] = [];
    const notFoundMembers: string[] = [];

    const selfAliases = new Set(['tôi', 'mình', 'tui', 'tao', 'tớ', 'ta']);
    const asciiSelfAliases = new Set(['toi', 'minh', 'tui', 'tao', 'to', 'ta']);
    const toAscii = (s: string) =>
      s
        .normalize('NFD')
        .replace(/\p{Diacritic}+/gu, '')
        .toLowerCase();
    const squeezeRepeats = (s: string) => s.replace(/(.)\1+/g, '$1');

    for (const memberName of params.memberNames) {
      this.logger.log(`[prepareInviteToGroup] Looking for: ${memberName}`);

      const norm = memberName.toLowerCase().trim();
      const ascii = toAscii(norm);

      // Handle self aliases
      if (
        selfAliases.has(norm) ||
        asciiSelfAliases.has(ascii) ||
        squeezeRepeats(ascii) === 'toi'
      ) {
        if (!memberIds.includes(userId)) {
          memberIds.push(userId);
          foundMemberNames.push(memberName);
        }
        this.logger.log(
          `[prepareInviteToGroup] Using self alias: ${memberName} -> userId ${userId}`,
        );
        continue;
      }

      // LLM self pronoun detection
      try {
        const isSelf = await this.llmService.isSelfPronoun(memberName);
        if (isSelf) {
          if (!memberIds.includes(userId)) {
            memberIds.push(userId);
            foundMemberNames.push(memberName);
          }
          this.logger.log(
            `[prepareInviteToGroup] LLM detected self: ${memberName} -> userId ${userId}`,
          );
          continue;
        }
      } catch (e) {
        this.logger.warn(
          `[prepareInviteToGroup] LLM self detection failed: ${(e as Error).message}`,
        );
      }

      // Fuzzy find contact
      const contact = await this.fuzzySearchService.fuzzyFindContact(
        userId,
        memberName,
      );

      if (contact && contact.type === 'direct' && contact.directChatId) {
        const directChat = await this.prisma.directChat.findUnique({
          where: { id: contact.directChatId },
        });
        if (directChat) {
          const friendId =
            directChat.creatorId === userId
              ? directChat.recipientId
              : directChat.creatorId;
          if (!memberIds.includes(friendId)) {
            memberIds.push(friendId);
            foundMemberNames.push(memberName);
          }
          this.logger.log(
            `[prepareInviteToGroup] Found: ${memberName} (ID: ${friendId})`,
          );
          continue;
        }
      }

      notFoundMembers.push(memberName);
      this.logger.log(`[prepareInviteToGroup] Not found: ${memberName}`);
    }

    if (memberIds.length === 0) {
      return {
        response: `Không tìm thấy thành viên: ${notFoundMembers.join(', ')}. Vui lòng thử lại.`,
      };
    }

    const confirmationMessage = `Bạn muốn mời ${foundMemberNames.join(', ')} vào nhóm "${foundGroup.name}", đúng không?`;

    this.logger.log(
      `[prepareInviteToGroup] Final return: groupId=${foundGroup.id}, memberIds=${JSON.stringify(memberIds)}, memberNames=${JSON.stringify(foundMemberNames)}`,
    );

    return {
      response: confirmationMessage,
      pending: {
        type: 'invite_to_group',
        targetId: foundGroup.id,
        targetName: foundGroup.name,
        content: foundMemberNames.join(', '),
        groupName: foundGroup.name,
        memberIds,
        memberNames: foundMemberNames,
        chatType: 'group',
        lastBotMessage: confirmationMessage,
      } as any,
    };
  }

  async prepareJoinGroup(
    userId: number,
    params: { groupName?: string },
  ): Promise<ExecutionResult> {
    this.logger.log(
      `[prepareJoinGroup] user=${userId}, groupName=${params.groupName}`,
    );

    if (!params.groupName || params.groupName.trim().length === 0) {
      return {
        response: 'Cần biết tên nhóm để tham gia. Vui lòng nói tên nhóm.',
      };
    }

    // Fuzzy search for group by name
    const allGroups = await this.prisma.groupChat.findMany({ take: 100 });
    let foundGroup: (typeof allGroups)[0] | null = null;
    let bestScore = -1;

    const searchTerm = params.groupName.toLowerCase().trim();

    for (const group of allGroups) {
      const groupName = group.name.toLowerCase();

      // Check exact substring match first
      if (groupName.includes(searchTerm) || searchTerm.includes(groupName)) {
        const score = 1.0;
        this.logger.log(
          `[prepareJoinGroup] Exact substring match: "${searchTerm}" in "${group.name}"`,
        );
        foundGroup = group;
        bestScore = score;
        break;
      }
    }

    // If no substring match, try fuzzy matching
    if (!foundGroup) {
      for (const group of allGroups) {
        const groupName = group.name.toLowerCase();
        const similarity = this.calculateStringSimilarity(
          searchTerm,
          groupName,
        );

        this.logger.log(
          `[prepareJoinGroup] Fuzzy match: "${searchTerm}" vs "${group.name}" - similarity: ${(similarity * 100).toFixed(1)}%`,
        );

        if (similarity > bestScore) {
          bestScore = similarity;
          foundGroup = group;
        }
      }
    }

    // Accept matches with similarity >= 0.6
    if (!foundGroup || bestScore < 0.6) {
      this.logger.log(
        `[prepareJoinGroup] Group not found: ${params.groupName} (best score: ${bestScore})`,
      );
      return {
        response: `Không tìm thấy nhóm "${params.groupName}". Vui lòng thử lại.`,
      };
    }

    this.logger.log(
      `[prepareJoinGroup] Found group: ${foundGroup.name} (score: ${bestScore})`,
    );

    const confirmationMessage = `Bạn muốn tham gia nhóm "${foundGroup.name}", đúng không?`;

    return {
      response: confirmationMessage,
      pending: {
        type: 'join_group',
        targetId: foundGroup.id,
        targetName: foundGroup.name,
        content: foundGroup.name,
        groupName: foundGroup.name,
        chatType: 'group',
        lastBotMessage: confirmationMessage,
      } as any,
    };
  }

  async reallyInviteToGroup(
    userId: number,
    groupId: number,
    groupName: string,
    memberIds: number[],
  ): Promise<string> {
    this.logger.log(
      `[reallyInviteToGroup] Adding ${memberIds.length} members to group ${groupId} (${groupName})`,
    );

    try {
      // Get the group to verify it exists
      const group = await this.prisma.groupChat.findUnique({
        where: { id: groupId },
        include: { Members: { select: { userId: true } } },
      });

      if (!group) {
        this.logger.warn(`[reallyInviteToGroup] Group not found: ${groupId}`);
        return `Nhóm "${groupName}" không tìm thấy.`;
      }

      // Get existing member IDs
      const existingMemberIds = new Set(group.Members.map((m) => m.userId));

      // Filter out members already in group
      const newMemberIds = memberIds.filter((id) => !existingMemberIds.has(id));

      if (newMemberIds.length === 0) {
        this.logger.log(`[reallyInviteToGroup] All members already in group`);
        return `Tất cả thành viên đã có trong nhóm "${groupName}".`;
      }

      // Add new members to group
      for (const memberId of newMemberIds) {
        await this.prisma.groupChatMember.create({
          data: {
            groupChatId: groupId,
            userId: memberId,
            joinedBy: userId, // Current user is adding the new member
          },
        });
      }

      this.logger.log(
        `[reallyInviteToGroup] ✅ Added ${newMemberIds.length} members to group ${groupId}`,
      );

      return `Đã mời ${newMemberIds.length} thành viên vào nhóm "${groupName}".`;
    } catch (err) {
      const errorMsg = (err as Error).message;
      this.logger.error(
        `[reallyInviteToGroup] Failed to invite members: ${errorMsg}`,
      );
      return `Lỗi khi mời vào nhóm: ${errorMsg}`;
    }
  }
}
