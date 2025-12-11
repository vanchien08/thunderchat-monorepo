import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule } from '@nestjs/config'
import { PrismaModule } from './configs/db/prisma.module'
import { EventEmitterModule } from '@nestjs/event-emitter'

const globalConfigModules = [
  ConfigModule.forRoot({
    envFilePath: ['.env.development', '.env'],
  }),
  PrismaModule,
  EventEmitterModule.forRoot({ verboseMemoryLeak: true, delimiter: ':' }),
]

import { SearchModule } from './search/search.module'
import { RequestLoggerMiddleware } from './app.middleware'
import { SmartSearchModule } from './smart-search/ai-search.module'

@Module({
  imports: [...globalConfigModules, SearchModule, SmartSearchModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
