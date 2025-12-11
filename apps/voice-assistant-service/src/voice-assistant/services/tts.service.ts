import { Injectable } from '@nestjs/common';
import { createClient, DeepgramClient } from '@deepgram/sdk';
import { LoggerService } from 'src/configs/logger/logger.service';

@Injectable()
export class TtsService {
  private deepgram: DeepgramClient;

  constructor(private readonly logger: LoggerService) {
    this.deepgram = createClient(process.env.DEEPGRAM_API_KEY);
  }

  async speak(text: string, rate: number = 1.0): Promise<string> {
    const cleanText = text.trim();
    if (!cleanText) return '';

    try {
      this.logger.log(
        `[TTS] Generating speech for: "${cleanText.substring(0, 50)}..."`,
      );

      const response = await this.deepgram.speak.request(
        { text: cleanText },
        {
          model: 'aura-asteria-en', // Female voice
          encoding: 'mp3',
        },
      );

      const stream = await response.getStream();
      if (!stream) {
        this.logger.warn('[TTS] No audio stream received from Deepgram');
        return '';
      }

      // Collect audio chunks
      const chunks: Buffer[] = [];
      const reader = stream.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(Buffer.from(value));
      }

      // Convert to base64
      const audioBuffer = Buffer.concat(chunks);
      const audioBase64 = audioBuffer.toString('base64');

      this.logger.log(
        `[TTS] Generated ${audioBase64.length} chars of base64 audio`,
      );

      return audioBase64;
    } catch (error) {
      this.logger.warn(`[TTS] Error generating speech: ${error.message}`);
      return '';
    }
  }
}
