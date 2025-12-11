import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './configs/db/prisma.module'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { JwtModule } from '@nestjs/jwt'
import ms from 'ms'

const globalConfigModules = [
  ConfigModule.forRoot({
    envFilePath: ['.env.development', '.env'],
  }),
  PrismaModule,
  JwtModule.register({
    global: true,
    secret: process.env.JWT_SECRET,
    signOptions: {
      expiresIn: ms(process.env.JWT_TOKEN_MAX_AGE_IN_HOUR),
    },
  }),
  EventEmitterModule.forRoot({ verboseMemoryLeak: true, delimiter: ':' }),
]

import { UserModule } from './user/user.module'
import { AuthModule } from './auth/auth.module'
import { FriendModule } from './friend/friend.module'
import { FriendRequestModule } from './friend-request/friend-request.module'
import { ProfileModule } from './profile/profile.module'
import { UserReportModule } from './user/user-report/user-report.module'
import { UserSettingsModule } from './user/user-settings/user-settings.module'
import { RequestLoggerMiddleware } from './app.middleware'

@Module({
  imports: [
    ...globalConfigModules,
    // User-related modules
    UserModule,
    UserSettingsModule,
    UserReportModule,
    ProfileModule,
    // Auth module
    AuthModule,
    // Friend-related modules
    FriendModule,
    FriendRequestModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
