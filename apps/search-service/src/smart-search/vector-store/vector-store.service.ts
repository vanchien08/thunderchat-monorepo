import { Injectable } from '@nestjs/common'
import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai'
import { PrismaService } from '@/configs/db/prisma.service'

interface SimilaritySearchResult {
  metadata: any
  score: number
}

@Injectable()
export class VectorStoreService {
  private embeddings: GoogleGenerativeAIEmbeddings

  constructor(private prisma: PrismaService) {
    this.embeddings = new GoogleGenerativeAIEmbeddings({
      apiKey: process.env.GOOGLE_API_KEY,
      modelName: 'text-embedding-004',
    })
  }

  async similaritySearch(
    query: string,
    userId: number,
    options: {
      k?: number
      filter?: Record<string, any>
    } = {}
  ): Promise<SimilaritySearchResult[]> {
    const { k = 5, filter = {} } = options

    const queryEmbedding = await this.embeddings.embedQuery(query)

    const conditions: string[] = ['m.is_deleted = false']
    const params: any[] = [queryEmbedding, userId, userId, userId]
    let paramIndex = 5 // Start from $5 since $1-$4 are already used

    conditions.push(`(
      m.author_id = $2
      OR m.recipient_id = $3
      OR EXISTS (
        SELECT 1 FROM group_chat_members gcm
        WHERE gcm.group_chat_id = m.group_chat_id
        AND gcm.user_id = $4
      )
    )`)

    if (filter.authorId) {
      conditions.push(`m.author_id = $${paramIndex}`)
      params.push(filter.authorId)
      paramIndex++
    }

    if (filter.createdAt?.$gte) {
      conditions.push(`m.created_at >= $${paramIndex}`)
      params.push(new Date(filter.createdAt.$gte))
      paramIndex++
    }

    if (filter.createdAt?.$lte) {
      conditions.push(`m.created_at <= $${paramIndex}`)
      params.push(new Date(filter.createdAt.$lte))
      paramIndex++
    }

    const whereClause = conditions.join(' AND ')

    // Tìm kiếm với pgvector
    const query_sql = `
      SELECT 
        me.message_id,
        me.metadata,
        1 - (me.embedding <=> $1::vector) as similarity
      FROM message_embeddings me
      INNER JOIN messages m ON m.id = me.message_id
      WHERE ${whereClause}
      ORDER BY similarity DESC
      LIMIT ${k}
    `

    const results = await this.prisma.$queryRawUnsafe<any[]>(query_sql, ...params)

    return results.map((r) => ({
      metadata: r.metadata,
      score: r.similarity,
    }))
  }
  async createEmbedding(text: string) {
    let a = await this.embeddings.embedQuery(text)
    return a
  }

  async saveMessageEmbedding(messageId: number, embedding: number[], metadata: any = {}) {
    metadata = JSON.parse(metadata)
    console.log('metadataa', metadata)
    return await this.prisma.$executeRaw`
    INSERT INTO message_embeddings (message_id, embedding, metadata, created_at)
    VALUES (${messageId}, ${embedding}::vector, ${JSON.stringify(metadata)}::jsonb, NOW())
    RETURNING *
  `
  }
}
