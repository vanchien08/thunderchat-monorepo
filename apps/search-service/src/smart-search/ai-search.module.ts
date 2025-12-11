// ai-search/ai-search.module.ts
import { Module } from '@nestjs/common'
import { AiSearchController } from './ai-search.controller'
import { RagService } from './rag/rag.service'
import { EmbeddingsService } from './embeddings/embeddings.service'
import { VectorStoreService } from './vector-store/vector-store.service'
import { PrismaService } from '@/configs/db/prisma.service'
import { VectorStoreGrpcController } from './vector-store/vector-store-grpc.controller'

@Module({
  controllers: [AiSearchController, VectorStoreGrpcController],
  providers: [RagService, EmbeddingsService, VectorStoreService, PrismaService],
  exports: [EmbeddingsService],
})
export class SmartSearchModule {}
