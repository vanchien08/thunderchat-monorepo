import { Module } from '@nestjs/common'
import { MessageMappingService } from './message-mapping.service'

@Module({
  providers: [MessageMappingService],
  exports: [MessageMappingService],
})
export class MessageMappingModule {}
