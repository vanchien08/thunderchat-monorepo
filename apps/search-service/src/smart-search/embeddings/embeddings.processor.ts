// ai-search/embeddings/embeddings.processor.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { EmbeddingsService } from './embeddings.service';
import { PrismaService } from '@/configs/db/prisma.service';

@Injectable()
export class EmbeddingsProcessor {
  private readonly logger = new Logger(EmbeddingsProcessor.name);

  constructor(
    private embeddingsService: EmbeddingsService,
    private prisma: PrismaService,
  ) {}

  // Chạy mỗi 5 phút để index messages mới
  @Cron(CronExpression.EVERY_5_MINUTES)
  async processNewMessages() {
    this.logger.log('Starting to process new messages...');

    try {
      // Tìm messages chưa được embed
      const unindexedMessages = await this.prisma.$queryRaw<
        Array<{ id: number }>
      >`
        SELECT m.id
        FROM messages m
        LEFT JOIN message_embeddings me ON me.message_id = m.id
        WHERE me.id IS NULL
        AND m.is_deleted = false
        AND m.type IN ('TEXT', 'MEDIA')
        LIMIT 100
      `;

      for (const message of unindexedMessages) {
        await this.embeddingsService.embedMessage(message.id);
      }

      this.logger.log(`Processed ${unindexedMessages.length} new messages`);
    } catch (error) {
      this.logger.error('Error processing new messages:', error);
    }
  }
}
