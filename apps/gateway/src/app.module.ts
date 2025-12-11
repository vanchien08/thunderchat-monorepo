import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { LoggerModule } from './configs/logger/logger.module'
import { PrismaModule } from './configs/db/prisma.module'
// import { JwtModule } from '@nestjs/jwt'
// import { envValidation } from './utils/validation/env.validation'
// import ms from 'ms'
// import { EventEmitterModule } from '@nestjs/event-emitter'

const globalConfigModules = [
  ConfigModule.forRoot({
    envFilePath: ['.env.development', '.env'],
    // validate: envValidation,
  }),
  LoggerModule,
  PrismaModule,
  // JwtModule.register({
  //   global: true,
  //   secret: process.env.JWT_SECRET,
  //   signOptions: {
  //     expiresIn: ms(process.env.JWT_TOKEN_MAX_AGE_IN_HOUR),
  //   },
  // }),
  // EventEmitterModule.forRoot({ verboseMemoryLeak: true, delimiter: ':' }),
]

// put gateway here to be able to get env right way
// import { AuthModule } from './auth/auth.module'
// import { DirectChatsModule } from './direct-chat/direct-chat.module'
// import { MessageModule } from './message/message.module'
// import { MediaMessageModule } from './message/media-message/media-message.module'
// import { UserModule } from './user/user.module'
// import { UserReportModule } from './user/user-report/user-report.module'
// import { ProfileModule } from './profile/profile.module'
// import { PinModule } from './message/pin/pin.module'
// import { UserSettingsModule } from './user/user-settings/user-settings.module'
// import { FriendModule } from './friend/friend.module'
// import { MessagingGatewayModule } from './messaging/messaging.module'
// import { StickersModule } from './message/stickers/stickers.module'
// import { FriendRequestModule } from './friend-request/friend-request.module'
// import { SearchModule } from './search/search.module'
// import { GroupChatModule } from './group-chat/group-chat.module'
// import { GroupMemberModule } from './group-member/group-member.module'
// import { DeleteMessageModule } from './message/delete-message/delete-message.module'
// import { AdminModule } from './admin/admin.module'
// import { PinConversationModule } from './pin-conversation/pin-conversation.module'
// import { HealthcheckModule } from './healthcheck/healthcheck.module'
// import { PushNotificationModule } from './configs/push-notification/push-notification.module'
// import { VoiceCallGatewayModule } from './voice-call/voice-call.module'
import { DevModule } from './dev/dev.module'
import { GrpcClientModule } from './configs/communication/grpc/grpc-client.module'
import { RequestLoggerMiddleware } from './app.middleware'

@Module({
  imports: [
    ...globalConfigModules,
    GrpcClientModule,
    // AuthModule,
    // MessagingGatewayModule,
    // VoiceCallGatewayModule,
    // DirectChatsModule,
    // MessageModule,
    // MediaMessageModule,
    // UserModule,
    // UserReportModule,
    // FriendRequestModule,
    // FriendModule,
    // StickersModule,
    // SearchModule,
    // GroupChatModule,
    // PinConversationModule,
    // GroupMemberModule,
    // ProfileModule,
    // PinModule,
    // UserSettingsModule,
    // DeleteMessageModule,
    // PushNotificationModule,
    // AdminModule,
    // HealthcheckModule,
    DevModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    this.initLoggingMiddleware(consumer)
  }

  initLoggingMiddleware(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
