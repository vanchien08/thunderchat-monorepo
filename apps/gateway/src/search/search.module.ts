import { Module } from '@nestjs/common'
import { SearchController } from './search.controller'
import { SearchService } from './search.service'
import { ElasticsearchModule } from '@/configs/elasticsearch/elasticsearch.module'
import { UserModule } from '@/user/user.module'
import { MessageModule } from '@/message/message.module'
import { UserConnectionService } from '@/connection/user-connection.service'
import { DirectChatsModule } from '@/direct-chat/direct-chat.module'
import { GroupChatModule } from '@/group-chat/group-chat.module'

@Module({
  imports: [ElasticsearchModule, UserModule, MessageModule, DirectChatsModule, GroupChatModule],
  controllers: [SearchController],
  providers: [SearchService, UserConnectionService],
})
export class SearchModule {}
