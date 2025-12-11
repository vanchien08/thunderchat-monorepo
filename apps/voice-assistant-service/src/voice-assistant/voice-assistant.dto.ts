// src/voice-assistant/voice-assistant.dto.ts
import { IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class VoiceCommandDto {
  @IsNotEmpty()
  audioBase64: string // mp3/wav base64 từ mobile
}
