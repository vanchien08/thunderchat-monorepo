// src/voice-assistant/voice-assistant.service.ts
import { Injectable, Inject, Logger } from '@nestjs/common';
import { PrismaService } from '@/configs/db/prisma.service';
import { EProviderTokens } from '@/utils/enums';
import {
  ExecutionResult,
  LlmResult,
  PendingAction,
} from './voice-assistant.interface';
import { SymmetricTextEncryptor } from '@/utils/crypto/symmetric-text-encryptor.crypto';
import { VoiceAssistantService as VoiceAssistantGrpcService } from '@/configs/communication/grpc/services/voice-assistant.service';
import { SttService } from './services/stt.service';
import { TtsService } from './services/tts.service';
import { LlmService } from './services/llm.service';
import { FuzzySearchService } from '../utils/fuzzy-search.service';
import { EMOTION_TO_CATEGORY_MAP } from '../utils/emotion-mapping';

import { MessageHandlerService } from './handlers/message-handler.service';
import { CallHandlerService } from './handlers/call-handler.service';
import { StickerHandlerService } from './handlers/sticker-handler.service';
import { GroupHandlerService } from './handlers/group-handler.service';
import { UserHandlerService } from './handlers/user-handler.service';
import { MY_MESSAGES_CUES } from '@/utils/voice-cues.constants';

interface IVoiceSettings {
  ttsEnabled: boolean;
  sttEnabled: boolean;
  autoReadMessages: boolean;
  speechRate: number;
}

@Injectable()
export class VoiceAssistantService {
  private readonly logger = new Logger(VoiceAssistantService.name);
  // In-Memory Map to store pending actions: userId -> {action, expiresAt}
  private pendingActions: Map<
    number,
    { action: PendingAction; expiresAt: number }
  > = new Map();
  private readonly symmetricTextEncryptor = new SymmetricTextEncryptor();

  constructor(
    @Inject(EProviderTokens.PRISMA_CLIENT) private prisma: PrismaService,
    private readonly sttService: SttService,
    private readonly ttsService: TtsService,
    private readonly llmService: LlmService,
    private readonly fuzzySearchService: FuzzySearchService,
    private readonly messageHandler: MessageHandlerService,
    private readonly callHandler: CallHandlerService,
    private readonly stickerHandler: StickerHandlerService,
    private readonly groupHandler: GroupHandlerService,
    private readonly userHandler: UserHandlerService,
  ) {}

  /**
   * Get pending action from in-memory map (with expiration check)
   */
  private getPendingAction(userId: number): PendingAction | null {
    const pending = this.pendingActions.get(userId);
    if (!pending) return null;

    // Check if expired
    if (Date.now() > pending.expiresAt) {
      this.pendingActions.delete(userId);
      return null;
    }

    return pending.action;
  }

  /**
   * Save pending action to in-memory map with TTL (seconds)
   */
  private setPendingAction(
    userId: number,
    action: PendingAction,
    ttlSeconds: number,
  ): void {
    this.pendingActions.set(userId, {
      action,
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  /**
   * Delete pending action from in-memory map
   */
  private deletePendingAction(userId: number): void {
    this.pendingActions.delete(userId);
  }

  /**
   * Public method to reset pending action (for controller)
   */
  resetPendingAction(userId: number): void {
    this.deletePendingAction(userId);
  }

  async processCommand(userId: number, audioBase64: string) {
    this.logger.log(`\n=== VOICE ASSISTANT START ===`);
    this.logger.log(`User ID: ${userId}`);
    this.logger.log(`Audio size: ${audioBase64.length} chars`);

    const settings = await this.getUserVoiceSettings(userId);

    // 1. STT
    this.logger.log(`[STEP 1] Starting STT transcription...`);
    const text = await this.sttService.transcribe(audioBase64, userId);
    this.logger.log(`[STEP 1] Transcript: "${text}"`);

    if (!text.trim()) {
      this.logger.warn(`[ERROR] Empty transcript received from STT`);
      this.logger.warn(`[ERROR] This usually means:`);
      this.logger.warn(
        `[ERROR] - Audio is too quiet (check microphone volume)`,
      );
      this.logger.warn(
        `[ERROR] - User spoke too fast after wake word (wait 0.5s)`,
      );
      this.logger.warn(`[ERROR] - Background noise is too high`);

      // Check if there's a pending action to cancel
      const pending = this.getPendingAction(userId);

      // If there's a pending action, cancel it
      if (pending) {
        this.logger.log(`[STEP 2] Cancelling pending action: ${pending.type}`);
        this.deletePendingAction(userId);

        const audio = await this.ttsService.speak(
          'Đã hủy thao tác trước đó.',
          settings.speechRate,
        );
        return {
          response: 'Đã hủy thao tác trước đó. Vui lòng thử lại.',
          audioBase64: audio,
          transcript: '',
          needsConfirmation: false,
          pending: null,
          clientAction: {
            type: (pending.type as any) || 'send_message',
            payload: {
              action: 'cancel',
              cancelledType: pending.type,
            },
          },
        };
      }

      // No pending action, just ask user to speak again
      const audio = await this.ttsService.speak(
        'Tôi không nghe rõ, bạn nói to và rõ hơn nhé.',
        settings.speechRate,
      );
      return {
        response: 'Không nghe rõ. Vui lòng nói to và rõ hơn.',
        audioBase64: audio,
        transcript: '',
      };
    }

    // 2. Check in-memory pending state
    this.logger.log(`[STEP 2] Checking pending action...`);
    const pending = this.getPendingAction(userId);
    if (pending) {
      this.logger.log(`[STEP 2] Found pending action: ${pending.type}`);
    } else {
      this.logger.log(`[STEP 2] No pending action`);
    }

    // 3. LLM
    this.logger.log(`[STEP 3] Processing intent with LLM...`);
    const llmResult: LlmResult = await this.llmService.callLLM(
      userId,
      text,
      pending,
    );
    this.logger.log(`[STEP 3] Intent: ${llmResult.function}`);
    this.logger.log(
      `[STEP 3] LLM Parameters: dateFilter=${llmResult.parameters?.dateFilter || '(EMPTY)'}, isMyMessages=${llmResult.parameters?.isMyMessages || '(EMPTY)'}, messageCount=${llmResult.parameters?.messageCount || '(EMPTY)'}`,
    );

    // 4. Execute
    this.logger.log(`[STEP 4] Executing function: ${llmResult.function}...`);
    const execResult: ExecutionResult = await this.executeFunction(
      userId,
      text,
      llmResult,
      pending,
      audioBase64,
    );
    this.logger.log(`[STEP 4] Response: "${execResult.response}"`);

    // 5. Lưu/Xóa context — HOÀN TOÀN TYPE-SAFE
    this.logger.log(`[STEP 5] Managing pending action state...`);
    if (execResult.pending) {
      this.logger.log(`[STEP 5] Saving pending action for 300s`);
      this.logger.log(
        `[STEP 5] Pending type: ${execResult.pending.type}, targetId: ${execResult.pending.targetId}`,
      );
      if ((execResult.pending as any).stickerId) {
        this.logger.log(
          `[STEP 5] Pending stickerId: ${(execResult.pending as any).stickerId}`,
        );
      }
      this.setPendingAction(userId, execResult.pending, 300);
    } else if (pending) {
      this.logger.log(`[STEP 5] Clearing previous pending action`);
      this.deletePendingAction(userId);
    }

    // 6. TTS
    this.logger.log(`[STEP 6] Generating TTS...`);
    const audio = await this.ttsService.speak(
      execResult.response,
      settings.speechRate,
    );
    this.logger.log(`=== VOICE ASSISTANT END ===\n`);

    const pendingResponse = execResult.pending
      ? {
          type: execResult.pending.type,
          targetId: execResult.pending.targetId,
          targetName: execResult.pending.targetName,
          content: execResult.pending.content,
          groupName: (execResult.pending as any).groupName,
          memberIds: (execResult.pending as any).memberIds,
          memberNames: (execResult.pending as any).memberNames,
          chatType: (execResult.pending as any).chatType || 'direct',
          isVideo: (execResult.pending as any).isVideo,
          stickerId: (execResult.pending as any).stickerId,
          stickerDescription: (execResult.pending as any).stickerDescription,
          // Provide the actual other participant's userId when available (direct chats)
          contactUserId:
            (execResult.pending as any).calleeUserId ||
            (execResult.pending as any).recipientUserId,
          recipientUserId: (execResult.pending as any).recipientUserId,
          // For backward compatibility and frontend convenience
          directChatId:
            (execResult.pending as any).chatType === 'group'
              ? undefined
              : execResult.pending.targetId,
          groupId:
            (execResult.pending as any).chatType === 'group'
              ? execResult.pending.targetId
              : undefined,
        }
      : null;

    // Log pending response for debugging
    if (pendingResponse) {
      this.logger.log(
        `[RESPONSE] Sending pending to frontend: type=${pendingResponse.type}, targetId=${pendingResponse.targetId}`,
      );
      if (pendingResponse.stickerId) {
        this.logger.log(
          `[RESPONSE] ✅ Pending includes stickerId: ${pendingResponse.stickerId}`,
        );
      }
      if (pendingResponse.memberIds) {
        this.logger.log(
          `[RESPONSE] ✅ Pending includes memberIds: ${JSON.stringify(pendingResponse.memberIds)}`,
        );
      }
    }

    return {
      transcript: text,
      response: execResult.response,
      audioBase64: audio,
      needsConfirmation: !!execResult.pending,
      // Include pending action details for frontend
      pending: pendingResponse,
      clientAction: execResult.clientAction || null,
    };
  }

  // ==================== Extracted Methods ====================
  // transcribe() → SttService
  // speak() → TtsService
  // callLLM(), classifyIntentWithLLM(), classifyIntentWithRules() → LlmService
  // fuzzyFindContact() → FuzzySearchService
  // EMOTION_TO_CATEGORY_MAP → utils/emotion-mapping.ts

  private async executeFunction(
    userId: number,
    text: string,
    result: LlmResult,
    pending: PendingAction | null,
    audioBase64?: string,
  ): Promise<ExecutionResult> {
    switch (result.function) {
      case 'check_new_messages':
        return await this.messageHandler.checkNewMessages(userId);

      case 'read_missed_calls':
        return await this.callHandler.readMissedCalls(userId);

      case 'read_latest_messages':
        const contactId = result.parameters?.contactId
          ? parseInt(result.parameters.contactId)
          : undefined;
        // IMPORTANT: If LLM explicitly set isMyMessages, use that value
        // Only fallback to heuristic if LLM didn't provide it (undefined/null)
        const isMyMessages =
          typeof result.parameters?.isMyMessages === 'boolean'
            ? result.parameters.isMyMessages
            : this.isMyMessagesQuery(text);
        return await this.messageHandler.readLatestMessagesById(
          userId,
          contactId,
          isMyMessages,
          result.parameters?.dateFilter,
          result.parameters?.messageCount,
        );

      case 'send_message':
        return await this.messageHandler.prepareSendMessageById(
          userId,
          result.parameters as { contactId?: string; content: string },
        );

      case 'send_voice_message':
        return await this.messageHandler.prepareSendVoiceMessageById(
          userId,
          result.parameters as { contactId?: string; contactType?: string },
          audioBase64,
        );

      case 'send_image':
        return await this.messageHandler.prepareSendImageById(
          userId,
          result.parameters as { contactId?: string },
        );

      case 'send_document':
      case 'send_file':
        return await this.messageHandler.prepareSendDocumentById(
          userId,
          result.parameters as { contactId?: string },
        );

      case 'make_call':
        return await this.callHandler.prepareMakeCallById(
          userId,
          result.parameters as { contactId?: string; isVideo: boolean },
        );

      case 'change_user_name':
        return await this.userHandler.prepareChangeUserName(
          userId,
          result.parameters as { newName: string },
        );

      case 'search_message':
        return await this.messageHandler.prepareSearchMessage(
          userId,
          result.parameters as { searchKeyword: string },
        );

      case 'search_smart':
        return await this.messageHandler.prepareSearchSmart(
          userId,
          result.parameters as { searchKeyword: string },
        );

      case 'send_sticker':
        return await this.stickerHandler.prepareSendSticker(
          userId,
          result.parameters as {
            contactId?: string;
            contactType?: string;
            stickerEmotion: string;
          },
        );

      case 'create_group':
        return await this.groupHandler.prepareCreateGroup(
          userId,
          result.parameters as { groupName: string; memberNames: string[] },
        );

      case 'invite_to_group':
        return await this.groupHandler.prepareInviteToGroup(
          userId,
          result.parameters as { groupName?: string; memberNames?: string[] },
        );

      case 'join_group':
        return await this.groupHandler.prepareJoinGroup(
          userId,
          result.parameters as { groupName?: string },
        );

      case 'confirm_action':
        // Handle incoming call acceptance when no pending action exists
        // This happens when user says "bắt máy" / "nghe máy" without prior pending
        if (!pending) {
          this.logger.log(
            `[executeFunction] Accept call command without pending - user may have incoming call`,
          );
          return {
            response: 'Đang nhận cuộc gọi...',
          };
        }

        if (pending?.type === 'send_message') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(`[executeFunction] User confirmed sending message`);
            this.logger.log(
              `[executeFunction] Pending details: targetId=${pending.targetId}, chatType=${(pending as any).chatType}, targetName=${pending.targetName}`,
            );
            try {
              if ((pending as any).chatType === 'group') {
                await this.messageHandler.sendGroupMessage(
                  pending.targetId,
                  pending.content,
                  userId,
                );
              } else {
                // Validate directChatId matches callee when available; adjust if needed
                let directChatId = pending.targetId;
                const calleeUserId = (pending as any).calleeUserId as
                  | number
                  | undefined;
                if (typeof calleeUserId === 'number') {
                  try {
                    const dc = await this.prisma.directChat.findUnique({
                      where: { id: directChatId },
                    });
                    const matches =
                      dc &&
                      ((dc.creatorId === userId &&
                        dc.recipientId === calleeUserId) ||
                        (dc.recipientId === userId &&
                          dc.creatorId === calleeUserId));
                    if (!matches) {
                      const corrected = await this.prisma.directChat.findFirst({
                        where: {
                          OR: [
                            {
                              creatorId: userId,
                              recipientId: calleeUserId,
                            },
                            {
                              creatorId: calleeUserId,
                              recipientId: userId,
                            },
                          ],
                        },
                      });
                      if (corrected) {
                        this.logger.warn(
                          `[executeFunction] Adjusted directChatId for send_message: ${directChatId} -> ${corrected.id} (callee=${calleeUserId})`,
                        );
                        directChatId = corrected.id;
                      } else {
                        this.logger.warn(
                          `[executeFunction] Could not find matching direct chat for (${userId}, ${calleeUserId}); using pending.targetId=${directChatId}`,
                        );
                      }
                    }
                  } catch (adjErr) {
                    this.logger.warn(
                      `[executeFunction] Adjustment check failed: ${(adjErr as Error).message}`,
                    );
                  }
                }

                await this.messageHandler.sendDirectMessage(
                  directChatId,
                  pending.content,
                  userId,
                );
              }
              return {
                response: `Đã gửi tin nhắn cho ${pending.targetName} thành công.`,
              };
            } catch (err) {
              this.logger.error(
                `[executeFunction] Error sending message:`,
                (err as Error).message,
              );
              return {
                response: `Lỗi khi gửi tin nhắn cho ${pending.targetName}. Vui lòng thử lại.`,
              };
            }
          } else {
            this.logger.log(`[executeFunction] User cancelled sending message`);
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending action state`);
            return {
              response: 'Đã hủy gửi tin nhắn.',
              clientAction: {
                type: 'send_message',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'send_voice_message') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(
              `[executeFunction] User confirmed sending voice message`,
            );
            this.logger.log(
              `[executeFunction] Pending details: targetId=${pending.targetId}, targetName=${pending.targetName}, chatType=${(pending as any).chatType}`,
            );
            try {
              if ((pending as any).chatType === 'group') {
                await this.messageHandler.sendGroupVoiceMessage(
                  pending.targetId,
                  pending.audioBase64 || '',
                  userId,
                );
              } else {
                // Validate directChatId matches recipient when available; adjust if needed
                let directChatId = pending.targetId;
                const recipientUserId = (pending as any).recipientUserId as
                  | number
                  | undefined;
                if (typeof recipientUserId === 'number') {
                  try {
                    const dc = await this.prisma.directChat.findUnique({
                      where: { id: directChatId },
                    });
                    const matches =
                      dc &&
                      ((dc.creatorId === userId &&
                        dc.recipientId === recipientUserId) ||
                        (dc.recipientId === userId &&
                          dc.creatorId === recipientUserId));
                    if (!matches) {
                      const corrected = await this.prisma.directChat.findFirst({
                        where: {
                          OR: [
                            {
                              creatorId: userId,
                              recipientId: recipientUserId,
                            },
                            {
                              creatorId: recipientUserId,
                              recipientId: userId,
                            },
                          ],
                        },
                      });
                      if (corrected) {
                        this.logger.warn(
                          `[executeFunction] Adjusted directChatId for send_voice_message: ${directChatId} -> ${corrected.id} (recipient=${recipientUserId})`,
                        );
                        directChatId = corrected.id;
                      } else {
                        this.logger.warn(
                          `[executeFunction] Could not find matching direct chat for (${userId}, ${recipientUserId}); using pending.targetId=${directChatId}`,
                        );
                      }
                    }
                  } catch (adjErr) {
                    this.logger.warn(
                      `[executeFunction] Adjustment check failed: ${(adjErr as Error).message}`,
                    );
                  }
                }

                await this.messageHandler.sendDirectVoiceMessage(
                  directChatId,
                  pending.audioBase64 || '',
                  userId,
                );
              }
              return {
                response: `Đã gửi tin nhắn voice cho ${pending.targetName} thành công.`,
              };
            } catch (err) {
              this.logger.error(
                `[executeFunction] Error sending voice message:`,
                (err as Error).message,
              );
              return {
                response: `Lỗi khi gửi tin nhắn voice cho ${pending.targetName}. Vui lòng thử lại.`,
              };
            }
          } else {
            this.logger.log(
              `[executeFunction] User cancelled sending voice message`,
            );
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy gửi tin nhắn voice.',
              clientAction: {
                type: 'send_voice_message',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'make_call') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(`[executeFunction] User confirmed making call`);
            try {
              const callType = (pending as any).isVideo ? 'video' : 'voice';
              await this.reallyMakeCall(
                pending.targetId,
                (pending as any).isVideo || false,
                userId,
                (pending as any).chatType,
              );
              return {
                response: `Đang ${callType === 'video' ? 'gọi video' : 'gọi thoại'} cho ${pending.targetName}...`,
              };
            } catch (err) {
              this.logger.error(
                `[executeFunction] Error making call:`,
                (err as Error).message,
              );
              return {
                response: `Lỗi khi gọi cho ${pending.targetName}. Vui lòng thử lại.`,
              };
            }
          } else {
            this.logger.log(`[executeFunction] User cancelled making call`);
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy cuộc gọi.',
              clientAction: {
                type: 'make_call',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'change_user_name') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(
              `[executeFunction] User confirmed changing name to: ${pending.content}`,
            );
            try {
              await this.userHandler.reallyChangeUserName(
                userId,
                pending.content,
              );
              return {
                response: `Đã đổi tên thành "${pending.content}" thành công.`,
              };
            } catch (err) {
              this.logger.error(
                `[executeFunction] Error changing name:`,
                (err as Error).message,
              );
              return {
                response: `Lỗi khi đổi tên. Vui lòng thử lại.`,
              };
            }
          } else {
            this.logger.log(`[executeFunction] User cancelled changing name`);
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy đổi tên.',
              clientAction: {
                type: 'send_message',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'search_message') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(
              `[executeFunction] User confirmed searching for: ${pending.content}`,
            );
            try {
              const result = await this.userHandler.reallySearchMessage(
                userId,
                pending.content,
              );
              return {
                response: result,
              };
            } catch (err) {
              this.logger.error(
                `[executeFunction] Error searching message:`,
                (err as Error).message,
              );
              return {
                response: `Lỗi khi tìm kiếm. Vui lòng thử lại.`,
              };
            }
          } else {
            this.logger.log(`[executeFunction] User cancelled searching`);
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy tìm kiếm.',
              clientAction: {
                type: 'send_message',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'search_smart') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(
              `[executeFunction] User confirmed smart searching for: ${pending.content}`,
            );
            // Return clientAction with pending action for frontend to handle smart search navigation
            return {
              response: `Đang tìm kiếm thông minh với từ khóa "${pending.content}"...`,
              pending: {
                type: 'search_smart',
                targetId: userId,
                targetName: 'Tìm kiếm thông minh',
                content: pending.content,
                lastBotMessage: `Đang tìm kiếm thông minh với từ khóa "${pending.content}"...`,
              } as any,
              clientAction: {
                type: 'search_smart',
                payload: {
                  query: pending.content,
                },
              },
            };
          } else {
            this.logger.log(`[executeFunction] User cancelled smart search`);
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy tìm kiếm thông minh.',
              clientAction: {
                type: 'send_message',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'send_sticker') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(`[executeFunction] User confirmed sending sticker`);
            this.logger.log(
              `[executeFunction] Pending details: stickerId=${pending.stickerId}, targetId=${pending.targetId}, chatType=${(pending as any).chatType}`,
            );
            try {
              await this.stickerHandler.reallySendSticker(
                pending.targetId,
                pending.stickerId!,
                userId,
                (pending as any).chatType,
              );
              return {
                response: `Đã gửi sticker cho ${pending.targetName} thành công.`,
              };
            } catch (err) {
              this.logger.error(
                `[executeFunction] Error sending sticker:`,
                (err as Error).message,
              );
              return {
                response: `Lỗi khi gửi sticker cho ${pending.targetName}. Vui lòng thử lại.`,
              };
            }
          } else {
            this.logger.log(`[executeFunction] User cancelled sending sticker`);
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy gửi sticker.',
              clientAction: {
                type: 'send_sticker',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'send_image') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(`[executeFunction] User confirmed sending image`);
            this.logger.log(
              `[executeFunction] Pending details: targetId=${pending.targetId}, chatType=${(pending as any).chatType}`,
            );
            // Return clientAction for frontend to handle file upload
            return {
              response: `Mở chọn ảnh để gửi cho ${pending.targetName}...`,
              clientAction: {
                type: 'send_image',
                payload: {
                  targetId: pending.targetId,
                  targetName: pending.targetName,
                  chatType: (pending as any).chatType,
                },
              },
            };
          } else {
            this.logger.log(`[executeFunction] User cancelled sending image`);
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy gửi ảnh.',
              clientAction: {
                type: 'send_image',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (
          pending?.type === 'send_document' ||
          pending?.type === 'send_file'
        ) {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(
              `[executeFunction] User confirmed sending document`,
            );
            this.logger.log(
              `[executeFunction] Pending details: targetId=${pending.targetId}, chatType=${(pending as any).chatType}`,
            );
            // Return clientAction for frontend to handle file upload
            return {
              response: `Mở chọn ${pending.type === 'send_file' ? 'file' : 'tài liệu'} để gửi cho ${pending.targetName}...`,
              clientAction: {
                type:
                  pending.type === 'send_file' ? 'send_file' : 'send_document',
                payload: {
                  targetId: pending.targetId,
                  targetName: pending.targetName,
                  chatType: (pending as any).chatType,
                },
              },
            };
          } else {
            this.logger.log(
              `[executeFunction] User cancelled sending document`,
            );
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy gửi tài liệu.',
              clientAction: {
                type:
                  pending.type === 'send_file' ? 'send_file' : 'send_document',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'join_group') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(`[executeFunction] User confirmed joining group`);
            this.logger.log(
              `[executeFunction] Pending details: groupName=${pending.targetName}, groupId=${pending.targetId}`,
            );
            const payload = {
              groupId: pending.targetId,
              groupName: pending.targetName,
            };
            this.logger.log(
              `[executeFunction] Sending clientAction payload to frontend: ${JSON.stringify(payload)}`,
            );
            return {
              response: `Đang tham gia nhóm "${pending.targetName}"...`,
              clientAction: {
                type: 'join_group',
                payload,
              },
            };
          } else {
            this.logger.log(`[executeFunction] User cancelled joining group`);
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy tham gia nhóm.',
              clientAction: {
                type: 'send_message',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'invite_to_group') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(
              `[executeFunction] User confirmed inviting to group`,
            );
            this.logger.log(
              `[executeFunction] Pending action: ${JSON.stringify(pending, null, 2)}`,
            );

            // Actually invite members to the group
            const inviteResult = await this.groupHandler.reallyInviteToGroup(
              userId,
              pending.targetId,
              pending.targetName,
              pending.memberIds || [],
            );

            this.logger.log(
              `[executeFunction] ======== INVITE_TO_GROUP CONFIRMATION ========`,
            );
            this.logger.log(`[executeFunction] groupId: ${pending.targetId}`);
            this.logger.log(
              `[executeFunction] groupName: ${pending.targetName}`,
            );
            this.logger.log(
              `[executeFunction] inviteeIds: ${JSON.stringify(pending.memberIds)}`,
            );
            this.logger.log(
              `[executeFunction] inviteeNames: ${JSON.stringify(pending.memberNames)}`,
            );
            this.logger.log(
              `[executeFunction] ========================================`,
            );

            // Clear pending action after successful invite
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);

            return {
              response: inviteResult,
            };
          } else {
            this.logger.log(
              `[executeFunction] User cancelled inviting to group`,
            );
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy mời vào nhóm.',
            };
          }
        }

        if (pending?.type === 'create_group') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(`[executeFunction] User confirmed creating group`);
            this.logger.log(
              `[executeFunction] Pending details: groupName=${pending.groupName}, memberCount=${pending.memberIds?.length}`,
            );
            const payload = {
              groupName: pending.groupName,
              memberIds: pending.memberIds,
              avatarUrl: null,
            };
            this.logger.log(
              `[executeFunction] Sending clientAction payload to frontend: ${JSON.stringify(payload)}`,
            );
            // Do NOT create the group here; send parameters to frontend
            return {
              response: `Đang tạo nhóm "${pending.groupName}" với ${pending.memberIds?.length} thành viên...`,
              clientAction: {
                type: 'create_group',
                payload,
              },
            };
          } else {
            this.logger.log(`[executeFunction] User cancelled creating group`);
            this.deletePendingAction(userId);
            this.logger.log(`[executeFunction] ✅ Reset pending state`);
            return {
              response: 'Đã hủy tạo nhóm.',
              clientAction: {
                type: 'create_group',
                payload: {
                  action: 'cancel',
                  cancelledType: pending.type,
                },
              },
            };
          }
        }

        if (pending?.type === 'incoming_call') {
          if (this.isAffirmative(text, pending.type)) {
            this.logger.log(`[executeFunction] User accepted incoming call`);
            return {
              response: 'Đang nhận cuộc gọi...',
            };
          } else {
            this.logger.log(`[executeFunction] User rejected incoming call`);
            return { response: 'Đã từ chối cuộc gọi.' };
          }
        }

        return { response: 'Đã xác nhận.' };

      case 'cancel_action':
        this.logger.log(
          `[executeFunction] User cancelled pending action: ${pending?.type}`,
        );
        this.deletePendingAction(userId);
        this.logger.log(`[executeFunction] Reset pending state`);
        if (pending?.type === 'incoming_call') {
          return {
            response: 'Đã từ chối cuộc gọi.',
            clientAction: {
              type: pending.type as any,
              payload: {
                action: 'cancel',
                cancelledType: pending.type,
              },
            },
          };
        }
        return {
          response: 'Đã hủy thao tác.',
          clientAction: {
            type: (pending?.type as any) || 'send_message',
            payload: {
              action: 'cancel',
              cancelledType: pending?.type,
            },
          },
        };

      case 'clarify':
        return {
          response:
            result.response ||
            'Bạn muốn làm gì vậy? Kiểm tra tin nhắn hay gửi tin nhắn?',
        };

      default:
        return {
          response: result.response || 'Tôi chưa hiểu, bạn nói lại nhé.',
        };
    }
  }

  // ==================== Helper Methods (Keep) ====================

  private async reallyMakeCall(
    chatId: number,
    isVideo: boolean,
    fromUserId: number,
    chatType?: string,
  ) {
    const callTypeStr = isVideo ? 'video' : 'voice';
    this.logger.log(
      `[reallyMakeCall] Initiating ${callTypeStr} call from user ${fromUserId} to chatId=${chatId}, chatType=${chatType}`,
    );

    try {
      // Handle group calls
      if (chatType === 'group') {
        this.logger.log(
          `[reallyMakeCall] Handling group call, fetching GroupChat with ID ${chatId}...`,
        );
        const groupChat = await this.prisma.groupChat.findUnique({
          where: { id: chatId },
        });

        if (!groupChat) {
          throw new Error(`GroupChat not found with ID ${chatId}`);
        }

        this.logger.log(
          `[reallyMakeCall] GroupChat found: ${groupChat.name}, caller=${fromUserId}`,
        );

        // For group calls, create CallSession without calleeUserId (group context)
        // Note: CallSession schema might need groupChatId field in future migration
        // For now, we skip CallSession creation for group calls or store minimal data
        this.logger.log(
          `[reallyMakeCall] Group call initiated (CallSession creation deferred for group calls)`,
        );

        // TODO: In a future migration, add groupChatId field to CallSession
        // For now, group calls are initiated without persisting to CallSession
        // Frontend can track group calls via real-time notifications

        return {
          id: `group-call-${chatId}`,
          isVideoCall: isVideo,
          status: 'REQUESTING',
        };
      }

      // Handle direct calls (default)
      this.logger.log(
        `[reallyMakeCall] Handling direct call, fetching DirectChat with ID ${chatId}...`,
      );
      const directChat = await this.prisma.directChat.findUnique({
        where: { id: chatId },
      });

      if (!directChat) {
        throw new Error(`DirectChat not found with ID ${chatId}`);
      }

      // Determine recipient (the other person in the chat)
      const recipientId =
        directChat.creatorId === fromUserId
          ? directChat.recipientId
          : directChat.creatorId;

      this.logger.log(
        `[reallyMakeCall] DirectChat found: caller=${fromUserId}, callee=${recipientId}`,
      );

      // 2. Create CallSession
      this.logger.log(`[reallyMakeCall] Creating direct CallSession...`);
      const callSession = await this.prisma.callSession.create({
        data: {
          directChatId: directChat.id,
          callerUserId: fromUserId,
          calleeUserId: recipientId,
          isVideoCall: isVideo,
          status: 'REQUESTING',
        },
      });

      this.logger.log(
        `[reallyMakeCall] Direct CallSession created successfully: ${callSession.id}, status: ${callSession.status}`,
      );

      // TODO: Send real-time notification to callee via WebSocket/gRPC
      // This would trigger the frontend to show incoming call UI

      return callSession;
    } catch (err) {
      this.logger.error(`[reallyMakeCall] Error:`, (err as Error).message);
      this.logger.error(`[reallyMakeCall] Stack:`, (err as Error).stack);
      throw err;
    }
  }

  private isAffirmative(text: string, pendingType?: string) {
    const lower = text.toLowerCase();
    const common = [
      'có',
      'ok',
      'oke',
      'okie',
      'ừ',
      'vâng',
      'đồng ý',
      'chấp nhận',
      'đúng rồi',
      'được',
      'xác nhận',
      'làm đi',
      'tiến hành',
    ];
    const perType: Record<string, string[]> = {
      send_message: ['gửi', 'gửi đi', 'send'],
      send_voice_message: ['gửi', 'gửi đi', 'send', 'ghi âm đi'],
      make_call: ['gọi', 'gọi đi', 'call'],
      change_user_name: ['đổi', 'đổi tên', 'đổi đi'],
      search_message: ['tìm', 'tìm đi', 'search'],
      search_smart: ['tìm', 'tìm đi', 'search', 'tìm thông minh'],
      send_sticker: ['gửi', 'gửi sticker'],
      create_group: [
        'tạo',
        'tạo đi',
        'tạo nhóm',
        'lập nhóm',
        'tạo luôn',
        'tạo nhé',
      ],
      incoming_call: ['bắt máy', 'nghe máy', 'trả lời'],
    };
    const keywords = pendingType
      ? common.concat(perType[pendingType] || [])
      : common;
    return keywords.some((w) => lower.includes(w));
  }

  // Detect queries asking for the user's own sent messages
  private isMyMessagesQuery(text: string): boolean {
    const t = text.toLowerCase();
    const cues = MY_MESSAGES_CUES;
    // Require presence of a message-related term when using generic "của tôi"
    if (t.includes('của tôi')) {
      if (t.includes('tin nhắn') || t.includes('nhắn') || t.includes('gửi')) {
        return true;
      }
    }
    return cues.some((c) => t.includes(c));
  }

  async getUserVoiceSettings(userId: number): Promise<IVoiceSettings> {
    try {
      const userSettings = await this.prisma.userSettings.findUnique({
        where: { userId },
      });

      // Default settings nếu không có trong DB
      const defaultSettings: IVoiceSettings = {
        ttsEnabled: true,
        sttEnabled: true,
        autoReadMessages: true,
        speechRate: 1.0,
      };

      if (!userSettings) {
        this.logger.log(
          `[getUserVoiceSettings] No settings found for user ${userId}, using defaults`,
        );
        return defaultSettings;
      }

      // Nếu có custom settings, merge với defaults
      return {
        ttsEnabled:
          userSettings.pushNotificationEnabled ?? defaultSettings.ttsEnabled,
        sttEnabled: defaultSettings.sttEnabled,
        autoReadMessages: defaultSettings.autoReadMessages,
        speechRate: defaultSettings.speechRate,
      };
    } catch (err) {
      this.logger.error(
        `[getUserVoiceSettings] Error:`,
        (err as Error).message,
      );
      // Fallback to defaults
      return {
        ttsEnabled: true,
        sttEnabled: true,
        autoReadMessages: true,
        speechRate: 1.0,
      };
    }
  }
}
