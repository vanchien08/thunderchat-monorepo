import { Controller, Logger } from '@nestjs/common'
import { GrpcMethod, RpcException } from '@nestjs/microservices'
import { EGrpcServices } from '@/utils/enums' // Đảm bảo enum này đúng với tên service trong .proto
import { VectorStoreService } from './vector-store.service'
import { CreateEmbeddingRequest, SaveMessageEmbeddingRequest } from 'protos/generated/search'

@Controller()
export class VectorStoreGrpcController {
  private readonly logger = new Logger(VectorStoreGrpcController.name)

  constructor(private readonly vectorStoreService: VectorStoreService) {}

  @GrpcMethod(EGrpcServices.SMART_SEARCH_SERVICE, 'CreateEmbedding')
  async createEmbedding(data: CreateEmbeddingRequest) {
    try {
      const embedding = await this.vectorStoreService.createEmbedding(data.text)

      return { embedding }
    } catch (error) {
      this.logger.error(`CreateEmbedding failed: ${error.message}`)
      throw new RpcException(error)
    }
  }

  @GrpcMethod(EGrpcServices.SMART_SEARCH_SERVICE, 'SaveMessageEmbedding')
  async saveMessageEmbedding(data: SaveMessageEmbeddingRequest) {
    try {
      await this.vectorStoreService.saveMessageEmbedding(
        Number(data.messageId), // Đảm bảo là number nếu proto gửi int64
        data.embedding,
        data.metaData
      )

      return { success: true }
    } catch (error) {
      this.logger.error(`SaveMessageEmbedding failed: ${error.message}`)
      return { success: false }
    }
  }
}
