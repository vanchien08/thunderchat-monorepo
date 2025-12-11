import type { VoiceAssistantService as VoiceAssistantServiceType } from 'protos/generated/notification'
import { firstValueFrom } from 'rxjs'

export interface IVoiceSettings {
  ttsEnabled: boolean
  sttEnabled: boolean
  autoReadMessages: boolean
  speechRate: number
}

export class VoiceAssistantService {
  constructor(private instance: VoiceAssistantServiceType) {}

  async processCommand(userId: number, audioBase64: string) {
    const result = await firstValueFrom(this.instance.ProcessCommand({ userId, audioBase64 }))
    return {
      transcript: result.transcript || '',
      response: result.response || '',
      audioBase64: result.audioBase64 || '',
      needsConfirmation: result.needsConfirmation || false,
    }
  }

  async getUserVoiceSettings(userId: number): Promise<IVoiceSettings | null> {
    const result = await firstValueFrom(this.instance.GetUserVoiceSettings({ userId }))
    return result.settingsJson ? (JSON.parse(result.settingsJson) as IVoiceSettings) : null
  }
}
