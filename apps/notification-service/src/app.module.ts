import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
// import { envValidation } from './utils/validation/env.validation'
import { PrismaModule } from './configs/db/prisma.module'
import { EventEmitterModule } from '@nestjs/event-emitter'

const globalConfigModules = [
  ConfigModule.forRoot({
    envFilePath: ['.env.development', '.env'],
    // validate: envValidation,
  }),
  PrismaModule,
  EventEmitterModule.forRoot({ verboseMemoryLeak: true, delimiter: ':' }),
]

import { PushNotificationModule } from './push-notification/push-notification.module'
import { RequestLoggerMiddleware } from './app.middleware'
// import { ClientsModule, Transport } from '@nestjs/microservices'
// import { join } from 'path'

@Module({
  imports: [...globalConfigModules, PushNotificationModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
