import { Injectable, Logger } from '@nestjs/common'
import { OpenAIEmbeddings } from '@langchain/openai'
import { PrismaService } from '@/configs/db/prisma.service'

@Injectable()
export class EmbeddingsService {
  private readonly logger = new Logger(EmbeddingsService.name)
  private embeddings: OpenAIEmbeddings

  constructor(private prisma: PrismaService) {
    this.embeddings = new OpenAIEmbeddings({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'text-embedding-3-small', // hoặc text-embedding-ada-002
    })
  }

  async embedMessage(messageId: number) {
    try {
      // Lấy message với thông tin liên quan
      const message = await this.prisma.message.findUnique({
        where: { id: messageId },
        include: {
          Author: {
            include: {
              Profile: true,
            },
          },
          DirectChat: true,
          GroupChat: true,
        },
      })
      if (!message || message.isDeleted) {
        return null
      }
      const decryptedContent = await this.decryptContent(message.content, message.dek)
      const textToEmbed = this.prepareTextForEmbedding(message, decryptedContent)

      const embedding = await this.embeddings.embedQuery(textToEmbed)

      const metadata = {
        messageId: message.id,
        authorId: message.authorId,
        authorName: message.Author.Profile?.fullName || 'Unknown',
        chatType: message.directChatId ? 'direct' : 'group',
        chatId: message.directChatId || message.groupChatId,
        createdAt: message.createdAt.toISOString(),
        messageType: message.type,
      }

      // Lưu vào database (sử dụng raw query cho pgvector)
      await this.prisma.$executeRaw`
        INSERT INTO message_embeddings (message_id, embedding, metadata, created_at)
        VALUES (${messageId}, ${embedding}::vector, ${JSON.stringify(metadata)}::jsonb, NOW())
        ON CONFLICT (message_id) DO UPDATE 
        SET embedding = EXCLUDED.embedding, metadata = EXCLUDED.metadata
      `

      return { messageId, success: true }
    } catch (error) {
      this.logger.error(`Failed to embed message ${messageId}:`, error)
      throw error
    }
  }

  private prepareTextForEmbedding(message: any, content: string): string {
    const authorName = message.Author.Profile?.fullName || 'Unknown'
    const date = message.createdAt.toLocaleDateString('vi-VN')
    const time = message.createdAt.toLocaleTimeString('vi-VN')

    return `
      Người gửi: ${authorName}
      Ngày: ${date}
      Giờ: ${time}
      Nội dung: ${content}
    `.trim()
  }

  private async decryptContent(encryptedContent: string, dek: string): Promise<string> {
    return encryptedContent
  }

  async embedAllMessages(userId: number) {
    const messages = await this.prisma.message.findMany({
      where: {
        OR: [
          { authorId: userId },
          { recipientId: userId },
          {
            GroupChat: {
              Members: {
                some: { userId },
              },
            },
          },
        ],
        isDeleted: false,
      },
      select: { id: true },
    })

    for (const message of messages) {
      await this.embedMessage(message.id)
    }
  }
}
