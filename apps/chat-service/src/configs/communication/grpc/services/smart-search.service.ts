import { firstValueFrom } from 'rxjs'
import type { MessageEmbeddingService as AIServiceType } from 'protos/generated/search'

export class SmartSearchService {
  constructor(private instance: AIServiceType) {}

  async createEmbedding(text: string): Promise<number[]> {
    const response = await firstValueFrom(
      this.instance.CreateEmbedding({
        text: text,
      })
    )

    return response.embedding
  }

  async saveMessageEmbedding(
    messageId: number,
    embedding: number[],
    metadata: any = {}
  ): Promise<boolean> {
    console.log('checkdata', metadata)
    const response = await firstValueFrom(
      this.instance.SaveMessageEmbedding({
        messageId: messageId,
        embedding: embedding,
        metaData: JSON.stringify(metadata as any),
      })
    )
    return response.success
  }
}
