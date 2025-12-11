import { Module } from '@nestjs/common'
import { MessagingGateway } from './messaging.gateway'
import { FriendService } from '@/friend/friend.service'
import { UserModule } from '@/user/user.module'
import { UserConnectionModule } from '../connection/user-connection.module'
import { MessageModule } from '@/message/message.module'
import { SyncDataToESModule } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.module'
import { GroupChatModule } from '@/group-chat/group-chat.module'
import { DirectChatsModule } from '@/direct-chat/direct-chat.module'
import { UserSettingsModule } from '@/user/user-settings/user-settings.module'
import { FriendModule } from '@/friend/friend.module'
import { PushNotificationModule } from '@/configs/push-notification/push-notification.module'

@Module({
  imports: [
    UserModule,
    UserConnectionModule,
    MessageModule,
    SyncDataToESModule,
    GroupChatModule,
    DirectChatsModule,
    UserSettingsModule,
    FriendModule,
    PushNotificationModule,
  ],
  providers: [MessagingGateway, FriendService],
})
export class MessagingGatewayModule {}
