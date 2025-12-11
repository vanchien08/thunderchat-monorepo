import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './configs/db/prisma.module';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { VoiceAssistantModule } from './voice-assistant/voice-assistant.module';
import { RequestLoggerMiddleware } from './app.middleware';

const globalConfigModules = [
  ConfigModule.forRoot({
    envFilePath: ['.env.development', '.env'],
  }),
  PrismaModule,
  EventEmitterModule.forRoot({ verboseMemoryLeak: true, delimiter: ':' }),
];

@Module({
  imports: [...globalConfigModules, VoiceAssistantModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
