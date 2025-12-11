import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/configs/db/prisma.service';
import { LoggerService } from 'src/configs/logger/logger.service';

interface FuzzyContactResult {
  type: 'direct' | 'group';
  directChatId?: number | null;
  groupId?: number;
  fullName: string;
}

@Injectable()
export class FuzzySearchService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async fuzzyFindContact(
    userId: number,
    name: string,
  ): Promise<FuzzyContactResult | null> {
    this.logger.log(
      `[fuzzyFindContact] Searching for contact: "${name}" for user ${userId}`,
    );
    const searchName = name.toLowerCase().trim();

    // ===== PRIORITY 1: Tìm trong Groups =====
    this.logger.log(
      `[fuzzyFindContact] Attempting to find in GroupChat table...`,
    );
    const groups = await this.prisma.groupChat.findMany({
      where: {
        Members: {
          some: { userId },
        },
      },
      include: {
        Members: true,
      },
    });

    this.logger.log(`[fuzzyFindContact] Groups found: ${groups.length}`);

    const groupCandidates: Array<{
      type: 'group';
      groupId: number;
      name: string;
      similarity: number;
    }> = [];

    // Tính độ tương đồng với từng group
    for (const g of groups) {
      const groupName = g.name?.toLowerCase() || '';
      const similarity = this.calculateSimilarity(searchName, groupName);

      this.logger.log(
        `[fuzzyFindContact] Group "${g.name}" vs "${name}": ${(similarity * 100).toFixed(1)}%`,
      );

      if (similarity > 0.4) {
        groupCandidates.push({
          type: 'group',
          groupId: g.id,
          name: g.name || 'Unknown Group',
          similarity,
        });
      }
    }

    // Nếu tìm thấy group, sắp xếp theo độ tương đồng và trả về cao nhất
    if (groupCandidates.length > 0) {
      groupCandidates.sort((a, b) => b.similarity - a.similarity);
      this.logger.log(
        `[fuzzyFindContact] Best group match: "${groupCandidates[0].name}" (${(groupCandidates[0].similarity * 100).toFixed(1)}%)`,
      );
      return {
        type: 'group' as const,
        groupId: groupCandidates[0].groupId,
        fullName: groupCandidates[0].name,
      };
    }

    // ===== PRIORITY 2 & 3: Search Friends AND DirectChat =====
    this.logger.log(`[fuzzyFindContact] Searching Friends table...`);
    const friends = await this.prisma.friend.findMany({
      where: {
        OR: [{ senderId: userId }, { recipientId: userId }],
      },
      include: {
        Sender: { include: { Profile: true } },
        Recipient: { include: { Profile: true } },
      },
    });

    this.logger.log(`[fuzzyFindContact] Friends found: ${friends.length}`);

    this.logger.log(`[fuzzyFindContact] Searching DirectChat table...`);
    const directChats = await this.prisma.directChat.findMany({
      where: {
        OR: [{ creatorId: userId }, { recipientId: userId }],
      },
      include: {
        Creator: { include: { Profile: true } },
        Recipient: { include: { Profile: true } },
      },
    });

    this.logger.log(
      `[fuzzyFindContact] DirectChats found: ${directChats.length}`,
    );

    // Combine all contacts from both Friends and DirectChat
    const allContacts: Array<{
      id: number;
      directChatId: number | null;
      fullName: string;
    }> = [];

    // Add Friends with their DirectChat ID
    for (const f of friends) {
      const contactId = f.senderId === userId ? f.recipientId : f.senderId;
      const directChat = await this.prisma.directChat.findUnique({
        where: {
          creatorId_recipientId: {
            creatorId: Math.min(userId, contactId),
            recipientId: Math.max(userId, contactId),
          },
        },
      });
      const profile =
        f.senderId === userId ? f.Recipient?.Profile : f.Sender?.Profile;
      allContacts.push({
        id: contactId,
        directChatId: directChat?.id || null,
        fullName: profile?.fullName || 'Unknown',
      });
    }

    // Add DirectChat contacts that are NOT already in Friends
    for (const dc of directChats) {
      const otherUserId =
        dc.creatorId === userId ? dc.recipientId : dc.creatorId;
      const profile =
        dc.creatorId === userId ? dc.Recipient?.Profile : dc.Creator?.Profile;

      const alreadyExists = allContacts.some((c) => c.id === otherUserId);
      if (!alreadyExists) {
        allContacts.push({
          id: otherUserId,
          directChatId: dc.id,
          fullName: profile?.fullName || 'Unknown',
        });
      }
    }

    this.logger.log(
      `[fuzzyFindContact] Total contacts (Friends + DirectChat): ${allContacts.length}`,
    );

    const candidates: Array<{
      id: number;
      directChatId: number | null;
      fullName: string;
      similarity: number;
    }> = [];

    // Tính độ tương đồng với từng contact
    for (const contact of allContacts) {
      const fullName = contact.fullName;
      if (!fullName) {
        this.logger.warn(`[fuzzyFindContact] Missing fullName for contact`);
        continue;
      }

      const contactName = fullName.toLowerCase();
      const similarity = this.calculateSimilarity(searchName, contactName);

      this.logger.log(
        `[fuzzyFindContact] "${fullName}" vs "${name}": ${(similarity * 100).toFixed(1)}%`,
      );

      candidates.push({
        id: contact.id,
        directChatId: contact.directChatId,
        fullName: fullName,
        similarity,
      });
    }

    // Sắp xếp theo độ tương đồng (cao nhất trước)
    candidates.sort((a, b) => b.similarity - a.similarity);

    // Lấy người có độ tương đồng cao nhất (nếu > 40%)
    if (candidates.length > 0 && candidates[0].similarity > 0.4) {
      this.logger.log(
        `[fuzzyFindContact] Best match: "${candidates[0].fullName}" (${(candidates[0].similarity * 100).toFixed(1)}%, directChatId=${candidates[0].directChatId})`,
      );
      return {
        type: 'direct' as const,
        directChatId: candidates[0].directChatId,
        fullName: candidates[0].fullName,
      };
    }

    this.logger.warn(
      `[fuzzyFindContact] No match found for: "${name}" (searched ${candidates.length} contacts + ${groups.length} groups)`,
    );
    return null;
  }

  /**
   * Tính độ tương đồng giữa 2 chuỗi (0-1)
   * Dùng Levenshtein distance + keyword matching
   */
  private calculateSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);

    // Remove Vietnamese particles (à, ơi, nhé, thôi, đi, luôn) from input for matching
    const cleanStr1 = str1.replace(/\s+(à|ơi|nhé|thôi|đi|luôn)$/, '').trim();
    const cleanStr2 = str2.replace(/\s+(à|ơi|nhé|thôi|đi|luôn)$/, '').trim();

    // Kiểm tra substring trước (nhanh hơn)
    if (cleanStr1.includes(cleanStr2) || cleanStr2.includes(cleanStr1)) {
      return 1.0;
    }
    if (str1.includes(str2) || str2.includes(str1)) {
      return 1.0;
    }

    // Split into words and check word overlap first
    const words1 = str1.split(/\s+/).filter((w) => w.length > 0);
    const words2 = str2.split(/\s+/).filter((w) => w.length > 0);

    // Nếu có word overlap, tính similarity dựa trên word match
    const commonWords = words1.filter((w1) =>
      words2.some(
        (w2) =>
          w1.includes(w2) ||
          w2.includes(w1) ||
          this.levenshteinDistance(w1, w2) <= 1,
      ),
    );

    if (commonWords.length > 0) {
      // If there's word overlap, boost the similarity
      const wordMatchRatio =
        commonWords.length / Math.max(words1.length, words2.length);
      const charSimilarity = Math.max(
        0,
        1 - this.levenshteinDistance(str1, str2) / maxLen,
      );
      return Math.min(1, wordMatchRatio * 0.6 + charSimilarity * 0.4);
    }

    // If no word overlap, penalize heavily (require very high char similarity)
    const charSimilarity = Math.max(
      0,
      1 - this.levenshteinDistance(str1, str2) / maxLen,
    );
    // Only accept if char similarity is very high (>0.7)
    return charSimilarity > 0.7 ? charSimilarity : charSimilarity * 0.5;
  }

  /**
   * Tính Levenshtein distance giữa 2 chuỗi
   */
  private levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;

    // Tạo ma trận DP
    const dp: number[][] = Array(len1 + 1)
      .fill(null)
      .map(() => Array(len2 + 1).fill(0));

    // Khởi tạo hàng & cột đầu tiên
    for (let i = 0; i <= len1; i++) dp[i][0] = i;
    for (let j = 0; j <= len2; j++) dp[0][j] = j;

    // Tính toán DP
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        if (str1[i - 1] === str2[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1];
        } else {
          dp[i][j] = Math.min(
            dp[i - 1][j] + 1, // deletion
            dp[i][j - 1] + 1, // insertion
            dp[i - 1][j - 1] + 1, // substitution
          );
        }
      }
    }

    return dp[len1][len2];
  }
}
