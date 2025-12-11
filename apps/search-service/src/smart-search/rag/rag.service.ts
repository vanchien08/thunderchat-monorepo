import { Injectable } from '@nestjs/common'
import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { PromptTemplate } from '@langchain/core/prompts'
import { RunnableSequence } from '@langchain/core/runnables'
import { StringOutputParser } from '@langchain/core/output_parsers'
import { VectorStoreService } from '../vector-store/vector-store.service'
import { PrismaService } from '@/configs/db/prisma.service'
import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-encryption.crypto'
import { EChatType } from '@/utils/enums'

export interface SearchResult {
  answer: string
  sources: Array<{
    messageId: number
    content: string
    author: string
    date: string
    relevanceScore: number
  }>
  hasResults: boolean
}

@Injectable()
export class RagService {
  private llm: ChatGoogleGenerativeAI
  private symmetricTextEncryptor: SymmetricTextEncryptor
  constructor(
    private vectorStore: VectorStoreService,
    private prisma: PrismaService
  ) {
    ;((this.symmetricTextEncryptor = new SymmetricTextEncryptor()),
      (this.llm = new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_API_KEY,
        model: 'gemini-2.5-flash',
        temperature: 0.3,
      })))
  }

  // async search(
  //   query: string,
  //   userId: number,
  //   options?: {
  //     startDate?: Date
  //     endDate?: Date
  //     authorId?: number
  //     chatId?: number
  //   }
  // ): Promise<SearchResult> {
  //   // 1. Tìm kiếm vector similarity
  //   const relevantMessages = await this.vectorStore.similaritySearch(query, userId, {
  //     k: 5, // top 5 messages
  //     filter: this.buildFilter(options),
  //   })

  //   if (relevantMessages.length === 0) {
  //     return {
  //       answer: 'Không tìm thấy tin nhắn nào liên quan đến câu hỏi của bạn.',
  //       sources: [],
  //       hasResults: false,
  //     }
  //   }

  //   // 2. Lấy thông tin đầy đủ của messages
  //   const messageIds = relevantMessages.map((m) => m.metadata.messageId)
  //   const messages = await this.prisma.message.findMany({
  //     where: { id: { in: messageIds } },
  //     include: {
  //       Author: {
  //         include: { Profile: true },
  //       },
  //     },
  //   })

  //   // 3. Decrypt content
  //   const decryptedMessages = await Promise.all(
  //     messages.map(async (msg) => ({
  //       ...msg,
  //       decryptedContent: await this.decryptContent(msg.content, msg.dek),
  //     }))
  //   )

  //   // 4. Tạo context cho RAG
  //   const context = this.buildContext(decryptedMessages)

  //   // 5. Tạo prompt và chạy RAG chain
  //   const answer = await this.runRagChain(query, context)

  //   // 6. Format kết quả
  //   return {
  //     answer,
  //     sources: decryptedMessages.map((msg, idx) => ({
  //       messageId: msg.id,
  //       content: msg.decryptedContent,
  //       author: msg.Author.Profile?.fullName || 'Unknown',
  //       date: msg.createdAt.toLocaleString('vi-VN'),
  //       relevanceScore: relevantMessages[idx].score,
  //     })),
  //     hasResults: true,
  //   }
  // }
  async search(
    query: string,
    userId: number,
    options?: {
      startDate?: Date
      endDate?: Date
      authorId?: number
      chatId?: number // Có thể là directChatId hoặc groupChatId
    }
  ): Promise<SearchResult> {
    // 1. Lấy tất cả ID DirectChat mà user tham gia
    const directChats = await this.prisma.directChat.findMany({
      where: {
        OR: [{ creatorId: userId }, { recipientId: userId }],
      },
      select: { id: true },
    })
    const userDirectChatIds = directChats.map((chat) => chat.id)

    // 2. Lấy tất cả ID GroupChat mà user là thành viên
    const groupChats = await this.prisma.groupChatMember.findMany({
      where: { userId: userId },
      select: { groupChatId: true },
    })
    const userGroupChatIds = groupChats.map((member) => member.groupChatId)

    // 3. Xây dựng filter
    const filter = this.buildFilter(options, userDirectChatIds, userGroupChatIds)

    // Xử lý trường hợp user tìm trong chat cụ thể mà họ không tham gia
    if (options?.chatId && filter === null) {
      return {
        answer:
          'Bạn không có quyền truy cập vào cuộc trò chuyện này hoặc cuộc trò chuyện không tồn tại.',
        sources: [],
        hasResults: false,
      }
    }

    // 4. Tìm kiếm vector similarity
    const relevantMessages = await this.vectorStore.similaritySearch(
      query,
      userId, // userId này có thể dùng cho RLS hoặc business logic khác trong vectorStore
      {
        k: 5, // top 5 messages
        filter: filter, // Sử dụng filter đã được xây dựng
      }
    )

    if (relevantMessages.length === 0) {
      return {
        answer: 'Không tìm thấy tin nhắn nào liên quan đến câu hỏi của bạn.',
        sources: [],
        hasResults: false,
      }
    }

    // 5. Lấy thông tin đầy đủ của messages
    const messageIds = relevantMessages.map((m) => m.metadata.messageId)
    const messages = await this.prisma.message.findMany({
      where: { id: { in: messageIds } },
      include: {
        Author: {
          include: { Profile: true },
        },
      },
    })

    // 6. Decrypt content
    const decryptedMessages = await Promise.all(
      messages.map(async (msg) => ({
        ...msg,
        decryptedContent: await this.decryptContent(msg.content, msg.dek),
      }))
    )

    const context = this.buildContext(decryptedMessages)

    const answer = await this.runRagChain(query, context)

    return {
      answer,
      sources: decryptedMessages.map((msg, idx) => {
        const isDirect = !!msg.directChatId
        const chatType = isDirect ? EChatType.DIRECT : EChatType.GROUP

        return {
          messageId: msg.id,
          content: msg.decryptedContent,
          author: msg.Author.Profile?.fullName || 'Unknown',
          chatId: msg.directChatId || msg.groupChatId || null,
          chatType,
          date: msg.createdAt.toLocaleString('vi-VN'),
          relevanceScore: relevantMessages[idx].score,
        }
      }),
      hasResults: true,
    }
  }

  private async runRagChain(query: string, context: string): Promise<string> {
    const promptTemplate = PromptTemplate.fromTemplate(`
Bạn là trợ lý AI giúp tìm kiếm thông tin trong lịch sử chat.

Context (các tin nhắn liên quan):
{context}

Câu hỏi của người dùng: {query}

Hãy trả lời câu hỏi dựa trên context được cung cấp. Nếu context không chứa thông tin để trả lời, hãy nói rằng không tìm thấy thông tin liên quan.

Yêu cầu:
- Trả lời bằng tiếng Việt
- Ngắn gọn, súc tích
- Trích dẫn cụ thể từ tin nhắn nếu có
- Nếu có nhiều tin nhắn liên quan, hãy tổng hợp thông tin

Trả lời:
    `)

    const chain = RunnableSequence.from([promptTemplate, this.llm, new StringOutputParser()])

    return await chain.invoke({
      context,
      query,
    })
  }

  private buildContext(messages: any[]): string {
    return messages
      .map((msg, idx) => {
        const author = msg.Author.Profile?.fullName || 'Unknown'
        const date = msg.createdAt.toLocaleDateString('vi-VN')
        const time = msg.createdAt.toLocaleTimeString('vi-VN', {
          hour: '2-digit',
          minute: '2-digit',
        })

        return `
[Tin nhắn ${idx + 1}]
Người gửi: ${author}
Thời gian: ${date} lúc ${time}
Nội dung: ${msg.decryptedContent}
---`
      })
      .join('\n\n')
  }

  // private buildFilter(options?: any): Record<string, any> {
  //   const filter: any = {}

  //   if (options?.startDate) {
  //     filter.createdAt = { $gte: options.startDate.toISOString() }
  //   }
  //   if (options?.endDate) {
  //     filter.createdAt = {
  //       ...filter.createdAt,
  //       $lte: options.endDate.toISOString(),
  //     }
  //   }
  //   if (options?.authorId) {
  //     filter.authorId = options.authorId
  //   }

  //   return filter
  // }

  private buildFilter(
    options: any,
    userDirectChatIds: number[],
    userGroupChatIds: number[]
  ): Record<string, any> | undefined {
    // Trả về null nếu chatId không hợp lệ
    const filter: any = {}

    if (options?.startDate) {
      filter.createdAt = { $gte: options.startDate.toISOString() }
    }
    if (options?.endDate) {
      filter.createdAt = {
        ...filter.createdAt,
        $lte: options.endDate.toISOString(),
      }
    }
    if (options?.authorId) {
      filter.authorId = options.authorId
    }

    // --- LOGIC MỚI CHO CHAT FILTER ---
    if (options?.chatId) {
      // Trường hợp 1: Người dùng muốn tìm trong 1 chat CỤ THỂ
      const chatId = options.chatId

      if (userDirectChatIds.includes(chatId)) {
        filter.directChatId = chatId
      } else if (userGroupChatIds.includes(chatId)) {
        filter.groupChatId = chatId
      } else {
        // Người dùng cung cấp chatId nhưng họ không ở trong chat đó
        return undefined
      }
    } else {
      // Trường hợp 2: Người dùng muốn tìm trong TẤT CẢ các chat của họ
      // (Đây là yêu cầu chính của bạn)
      filter.$or = [
        { directChatId: { $in: userDirectChatIds } },
        { groupChatId: { $in: userGroupChatIds } },
      ]
    }
    // --- KẾT THÚC LOGIC MỚI ---

    return filter
  }

  private async decryptContent(encryptedContent: string, encryptedDek: string): Promise<string> {
    try {
      if (!encryptedContent || !encryptedDek) {
        console.error('Missing content or DEK')
        return '[Thiếu dữ liệu mã hóa]'
      }

      const secretKey = process.env.MESSAGES_ENCRYPTION_SECRET_KEY

      const dek = this.symmetricTextEncryptor.decrypt(encryptedDek, secretKey)

      const decrypted = this.symmetricTextEncryptor.decrypt(encryptedContent, dek)

      return decrypted
    } catch (error) {
      console.error('   Error name:', error.name)
      console.error('   Error message:', error.message)
      console.error('   Stack:', error.stack)
      return '[Không thể giải mã]'
    }
  }
}
