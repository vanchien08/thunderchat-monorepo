import { Controller, Post, Body } from '@nestjs/common';
import { VoiceAssistantService } from './voice-assistant.service';
import { VoiceCommandDto } from './voice-assistant.dto';
import { TUser } from '@/utils/entities/user.entity';
import { User } from '@/user/user.decorator';
import { ERoutes } from '@/utils/enums';

@Controller(ERoutes.VOICE_ASSISTANT)
export class VoiceAssistantController {
  constructor(private readonly voiceService: VoiceAssistantService) {}

  @Post('command')
  async handleCommand(@User() user: TUser, @Body() dto: VoiceCommandDto) {
    return this.voiceService.processCommand(user.id, dto.audioBase64);
  }

  @Post('reset-pending')
  async resetPending(@User() user: TUser) {
    this.voiceService.resetPendingAction(user.id);
    return { success: true };
  }
}
