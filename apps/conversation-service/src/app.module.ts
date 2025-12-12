import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { RequestLoggerMiddleware } from './app.middleware'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './configs/db/prisma.module'
import { EventEmitterModule } from '@nestjs/event-emitter/dist/event-emitter.module'

const globalConfigModules = [
  ConfigModule.forRoot({
    envFilePath: ['.env.development', '.env'],
  }),
  PrismaModule,
  EventEmitterModule.forRoot({ verboseMemoryLeak: true, delimiter: ':' }),
]

import { DirectChatsModule } from './direct-chat/direct-chat.module'
import { GroupChatModule } from './group-chat/group-chat.module'
import { GroupMemberModule } from './group-member/group-member.module'
import { MessageModule } from './message/message.module'
import { PinConversationModule } from './pin-conversation/pin-conversation.module'

@Module({
  imports: [
    ...globalConfigModules,
    DirectChatsModule,
    GroupChatModule,
    GroupMemberModule,
    PinConversationModule,
    MessageModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
