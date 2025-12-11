import { Module } from '@nestjs/common'
import { DevController } from './dev.controller'
import { MessageService } from '@/message/message.service'
import { ElasticsearchModule } from '@/configs/elasticsearch/elasticsearch.module'
import { MessageMappingModule } from '@/message-mapping/message-mapping.module'
import { SyncDataToESService } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.service'

@Module({
  imports: [ElasticsearchModule, MessageMappingModule],
  controllers: [DevController],
  providers: [MessageService, SyncDataToESService],
})
export class DevModule {}
