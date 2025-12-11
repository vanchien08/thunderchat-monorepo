import { Module } from '@nestjs/common'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'
import { ElasticsearchModule } from '@/configs/elasticsearch/elasticsearch.module'

@Module({
  imports: [GrpcClientModule, ElasticsearchModule],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
