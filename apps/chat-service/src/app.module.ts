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

import { MessagingGatewayModule } from './messaging/messaging.module'

@Module({
  imports: [...globalConfigModules, MessagingGatewayModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
