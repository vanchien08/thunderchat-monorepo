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

import { UploadModule } from './upload/upload.module'
import { RequestLoggerMiddleware } from './app.middleware'

@Module({
  imports: [...globalConfigModules, UploadModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*')
  }
}
