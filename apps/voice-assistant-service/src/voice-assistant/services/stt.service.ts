import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/configs/db/prisma.service';
import { LoggerService } from 'src/configs/logger/logger.service';
import { UnknownException } from '@/utils/exceptions/system.exception';

@Injectable()
export class SttService {
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
  ) {}

  async transcribe(audioBase64: string, userId?: number): Promise<string> {
    try {
      this.logger.log(`[STT] transcribe() called`);
      this.logger.log(
        `[STT] audioBase64 length: ${audioBase64?.length || 0} chars`,
      );
      this.logger.log(
        `[STT] audioBase64 starts with: ${audioBase64?.substring(0, 50) || 'EMPTY'}`,
      );
      this.logger.log(`[STT] userId: ${userId}`);

      if (!audioBase64 || audioBase64.trim().length === 0) {
        this.logger.warn('[STT] ⚠️ Empty audioBase64 received from frontend');
        return '';
      }

      // Convert base64 to Buffer
      let audioBuffer: Buffer;
      try {
        audioBuffer = Buffer.from(audioBase64, 'base64');
        this.logger.log(
          `[STT] ✅ Decoded base64 → Buffer size: ${audioBuffer.length} bytes`,
        );
      } catch (decodeErr) {
        this.logger.error(
          new UnknownException(
            `[STT] Failed to decode base64: ${decodeErr.message}`,
            decodeErr,
          ),
        );
        return '';
      }

      if (audioBuffer.length === 0) {
        this.logger.warn('[STT] ⚠️ Audio buffer is empty after decoding');
        return '';
      }

      this.logger.log(`[STT] Audio buffer size: ${audioBuffer.length} bytes`);

      const commandKeywords = [
        'gọi điện',
        'gọi video',
        'gửi tin nhắn',
        'đọc tin nhắn',
        'kiểm tra',
        'bắt máy',
        'nghe máy',
        'từ chối',
        'xác nhận',
        'hủy',
      ];

      let recentContacts: string[] = [];
      if (userId) {
        try {
          const recentMessages = await this.prisma.message.findMany({
            where: {
              OR: [{ authorId: userId }, { recipientId: userId }],
            },
            select: {
              Author: { select: { Profile: { select: { fullName: true } } } },
              DirectChat: {
                select: {
                  Creator: {
                    select: { Profile: { select: { fullName: true } } },
                  },
                  Recipient: {
                    select: { Profile: { select: { fullName: true } } },
                  },
                },
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 5,
          });

          recentContacts = recentMessages
            .map((m) => {
              let name = '';
              if (m.DirectChat) {
                name =
                  m.DirectChat.Creator?.Profile?.fullName === undefined
                    ? m.DirectChat.Recipient?.Profile?.fullName || ''
                    : m.DirectChat.Creator?.Profile?.fullName || '';
              }
              return name.toLowerCase() || '';
            })
            .filter((n) => n.length > 0)
            .slice(0, 5);
        } catch (err) {
          this.logger.warn(
            `Failed to get recent contacts: ${err instanceof Error ? err.message : 'Unknown error'}`,
          );
        }
      }

      // Combine - tổng cộng tối đa 15 keywords
      const keywords = [...commandKeywords, ...recentContacts];
      this.logger.log(`STT keywords: ${keywords.join(', ')}`);

      const params = new URLSearchParams({
        model: 'nova-2-general',
        language: 'vi',

        smart_format: 'true',
        punctuate: 'true',

        keywords: keywords.join(','),
        keywords_threshold: '0',

        diarize: 'false',
        filler_words: 'true',

        endpointing: '100',

        utterance_end_ms: '200',

        profanity_filter: 'false',
        redact: 'false',

        channels: '1',

        numerals: 'false',

        interim_results: 'true',
      });

      const response = await fetch(
        `https://api.deepgram.com/v1/listen?${params.toString()}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
            'Content-Type': 'audio/webm;codecs=opus',
          },
          body: audioBuffer as any,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.log(
          `[STT] ❌ Deepgram API error: ${response.status} - ${errorText}`,
        );
        this.logger.error(
          new UnknownException(
            `Deepgram API error: ${response.status} - ${errorText}`,
          ),
        );
        return ''; // Return empty thay vì fallback
      }

      const result = await response.json();
      this.logger.log(`[STT] Deepgram response received`);
      this.logger.log(
        `[STT] Response structure: ${JSON.stringify(result, null, 2).substring(0, 500)}`,
      );

      let transcript =
        result.results?.channels?.[0]?.alternatives?.[0]?.transcript || '';
      const confidence =
        result.results?.channels?.[0]?.alternatives?.[0]?.confidence || 0;
      let words = result.results?.channels?.[0]?.alternatives?.[0]?.words || [];

      this.logger.log(`[STT] Main transcript: "${transcript}"`);
      this.logger.log(`[STT] Confidence: ${confidence}`);
      this.logger.log(`[STT] Words count: ${words.length}`);

      if (!transcript.trim() && result.results?.channels?.[0]?.alternatives) {
        this.logger.log(
          `[STT] Empty main transcript, checking for ${result.results.channels[0].alternatives.length} interim results...`,
        );
        const alternatives = result.results.channels[0].alternatives;

        for (let i = 0; i < alternatives.length; i++) {
          const alt = alternatives[i];
          this.logger.log(`[STT] Interim[${i}]: "${alt.transcript}"`);
          if (alt.transcript && alt.transcript.trim()) {
            transcript = alt.transcript;
            words = alt.words || [];
            this.logger.log(
              `[STT] ✅ Extracted from interim result[${i}]: "${transcript}"`,
            );
            break;
          }
        }
      }

      if (words.length > 0) {
        this.logger.log('📝 Word-by-word analysis:');
        words.forEach((w: any) => {
          this.logger.log(
            `   "${w.word}" (confidence: ${w.confidence.toFixed(2)}, start: ${w.start}s)`,
          );
        });
      }

      if (!transcript.trim()) {
        this.logger.warn('⚠️ Empty transcript received');
        this.logger.warn(`📊 Metadata: ${JSON.stringify(result.metadata)}`);
        this.logger.warn('💡 Suggestions:');
        this.logger.warn('   - Check microphone permissions');
        this.logger.warn('   - Verify audio is actually being recorded');
        this.logger.warn('   - Test with longer speech (2-3 seconds)');
        this.logger.warn('   - Check for codec issues in browser');
        return '';
      }

      const normalized = this.normalizeVietnameseText(transcript);

      this.logger.log(
        `✅ Transcript: "${normalized}" (confidence: ${confidence.toFixed(2)}, words: ${words.length})`,
      );

      if (confidence < 0.5) {
        this.logger.warn(
          `⚠️ Low confidence (${confidence.toFixed(2)}). Audio quality may be poor.`,
        );
      }

      return normalized;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.logger.error(
        new UnknownException(
          `Deepgram transcription error: ${err.message}`,
          err,
        ),
      );
      this.logger.log(err.stack || '');
      return '';
    }
  }

  private normalizeVietnameseText(text: string): string {
    let normalized = text.trim().toLowerCase();

    const corrections: Record<string, string> = {
      'ngay máy': 'nghe máy',
      'nghe mấy': 'nghe máy',
      'nghe mạch': 'nghe máy',
      'đánh máy': 'nghe máy',
      'nói máy': 'nghe máy',
      'ngay em': 'nghe máy',
      'bát máy': 'bắt máy',
      'bạt máy': 'bắt máy',

      'gọi đi thoại': 'gọi điện thoại',
      'gọi đi': 'gọi điện',
      'video kô': 'video call',
      'vê đê ô': 'video',

      'ổ kê': 'oke',
      'ô kê': 'oke',
      ok: 'oke',
      okay: 'oke',
    };

    Object.entries(corrections).forEach(([wrong, correct]) => {
      normalized = normalized.replace(new RegExp(wrong, 'gi'), correct);
    });

    normalized = normalized.replace(/\s+/g, ' ').trim();

    return normalized;
  }
}
