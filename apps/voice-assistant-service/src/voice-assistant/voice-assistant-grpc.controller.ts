import { Controller } from '@nestjs/common';
import { GrpcMethod } from '@nestjs/microservices';
import { VoiceAssistantService } from './voice-assistant.service';

@Controller()
export class VoiceAssistantGrpcController {
  constructor(private voiceAssistantService: VoiceAssistantService) {}

  @GrpcMethod('VoiceAssistantService', 'ProcessCommand')
  async ProcessCommand(data: { userId: number; audioBase64: string }) {
    const result = await this.voiceAssistantService.processCommand(
      data.userId,
      data.audioBase64,
    );
    return {
      transcript: result.transcript || '',
      response: result.response || '',
      audioBase64: result.audioBase64 || '',
      needsConfirmation: result.needsConfirmation || false,
    };
  }

  @GrpcMethod('VoiceAssistantService', 'GetUserVoiceSettings')
  async GetUserVoiceSettings(data: { userId: number }) {
    const settings = await this.voiceAssistantService.getUserVoiceSettings(
      data.userId,
    );
    return {
      settingsJson: settings ? JSON.stringify(settings) : null,
    };
  }
}
