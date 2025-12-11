import { Module } from '@nestjs/common'
import { SyncDataToESService } from './sync-data-to-ES.service'
import { MessageMappingModule } from '@/message-mapping/message-mapping.module'

@Module({
  imports: [MessageMappingModule],
  providers: [SyncDataToESService],
  exports: [SyncDataToESService, MessageMappingModule],
})
export class SyncDataToESModule {}
