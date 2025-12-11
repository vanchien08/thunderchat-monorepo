// src/voice-assistant/voice-assistant.module.ts
import { Module } from '@nestjs/common';
import { VoiceAssistantController } from './voice-assistant.controller';
import { VoiceAssistantGrpcController } from './voice-assistant-grpc.controller';
import { VoiceAssistantService } from './voice-assistant.service';
import { PrismaModule } from '@/configs/db/prisma.module';

// Services
import { SttService } from './services/stt.service';
import { TtsService } from './services/tts.service';
import { LlmService } from './services/llm.service';

// Utils
import { FuzzySearchService } from '../utils/fuzzy-search.service';

// Handlers
import { MessageHandlerService } from './handlers/message-handler.service';
import { CallHandlerService } from './handlers/call-handler.service';
import { StickerHandlerService } from './handlers/sticker-handler.service';
import { GroupHandlerService } from './handlers/group-handler.service';
import { UserHandlerService } from './handlers/user-handler.service';

@Module({
  imports: [PrismaModule],
  controllers: [VoiceAssistantController, VoiceAssistantGrpcController],
  providers: [
    VoiceAssistantService,
    // Core services
    SttService,
    TtsService,
    LlmService,
    // Utilities
    FuzzySearchService,
    // Handlers
    MessageHandlerService,
    CallHandlerService,
    StickerHandlerService,
    GroupHandlerService,
    UserHandlerService,
  ],
  exports: [VoiceAssistantService],
})
export class VoiceAssistantModule {}
