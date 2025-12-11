import { Injectable } from '@nestjs/common';
import { ChatGoogleGenerativeAI } from '@langchain/google-genai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { PrismaService } from 'src/configs/db/prisma.service';
import { LoggerService } from 'src/configs/logger/logger.service';
import { LlmResult } from '../voice-assistant.interface';
import {
  UNIVERSAL_CONFIRMATION_CUES,
  ACTION_SPECIFIC_CONFIRMATION_CUES,
} from '../../utils/voice-cues.constants';
import { FuzzySearchService } from '../../utils/fuzzy-search.service';
import { ChatGroq } from '@langchain/groq';
@Injectable()
export class LlmService {
  // private llm: ChatGoogleGenerativeAI;
  private llm: ChatGroq;
  constructor(
    private readonly logger: LoggerService,
    private readonly prisma: PrismaService,
    private readonly fuzzySearchService: FuzzySearchService,
  ) {
    // this.llm = new ChatGoogleGenerativeAI({
    //   model: 'gemini-2.5-flash-lite',
    //   maxOutputTokens: 2048,
    //   apiKey: process.env.GEMINI_API_KEY,
    // });
    this.llm = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: 'llama-3.3-70b-versatile', // hoặc mixtral-8x7b-32768 mixtral-8x7b  gemma2-9b llama-3.1-8b-instant
      temperature: 0.3,
    });
  }

  async callLLM(
    userId: number,
    text: string,
    pending: any,
  ): Promise<LlmResult> {
    console.log(`[LLM] === callLLM() START === text: "${text}"`);

    // Check if we should use LLM or fallback to rule-based
    if (!process.env.GEMINI_API_KEY) {
      console.warn(`[LLM] GEMINI_API_KEY not set, using rule-based matching`);
      this.logger.warn(`[LLM] GEMINI_API_KEY not set`);
      return await this.classifyIntentWithRules(text, pending);
    }

    console.log(
      `[LLM] GEMINI_API_KEY is set, calling classifyIntentWithLLM...`,
    );

    try {
      // Add timeout of 30 seconds to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(
          () => reject(new Error('LLM API call timeout (30s)')),
          30000,
        ),
      );

      const result = await Promise.race([
        this.classifyIntentWithLLM(userId, text, pending),
        timeoutPromise,
      ]);

      console.log(`[LLM] === callLLM() SUCCESS ===`);
      return result;
    } catch (err) {
      console.error(
        `[LLM ERROR] Classification failed: ${(err as Error).message}`,
        err,
      );

      console.log(`[LLM] Falling back to rule-based matching...`);
    }

    // Fallback to rule-based matching
    console.log(`[LLM] === callLLM() FALLBACK to RULES ===`);
    return await this.classifyIntentWithRules(text, pending);
  }

  private async classifyIntentWithLLM(
    userId: number,
    text: string,
    pending: any,
  ): Promise<LlmResult> {
    this.logger.log(`[classifyIntentWithLLM] START - text="${text}"`);

    // If there's a pending action, check for simple confirmation/cancellation FIRST
    // This avoids issues with noisy STT that might contain action keywords
    if (pending) {
      const normalizedText = text.toLowerCase().trim();

      // IMPORTANT: Check if this is a NEW intent, not just confirmation
      // If text contains action keywords that differ from pending type, let LLM handle it
      const hasNewIntentKeywords =
        (normalizedText.includes('âm thanh') ||
          normalizedText.includes('voice')) &&
        pending.type === 'send_message';

      if (hasNewIntentKeywords) {
        this.logger.log(
          `[classifyIntentWithLLM] Detected new intent (voice message) despite pending send_message, skipping early confirmation check`,
        );
        // Skip confirmation detection and let LLM classify
      } else {
        // Universal confirmation patterns that work regardless of pending type
        const universalConfirmationPatterns = UNIVERSAL_CONFIRMATION_CUES;

        // Action-specific confirmation words (only add to list if pending type matches)
        let actionSpecificConfirmations: string[] = [];

        if (
          pending.type === 'send_message' ||
          pending.type === 'send_voice_message'
        ) {
          actionSpecificConfirmations =
            ACTION_SPECIFIC_CONFIRMATION_CUES['send_message'] || [];
        }
        if (pending.type === 'make_call') {
          actionSpecificConfirmations =
            ACTION_SPECIFIC_CONFIRMATION_CUES['make_call'] || [];
        }
        if (pending.type === 'send_sticker') {
          actionSpecificConfirmations =
            ACTION_SPECIFIC_CONFIRMATION_CUES['send_sticker'] || [];
        }
        if (pending.type === 'create_group') {
          actionSpecificConfirmations =
            ACTION_SPECIFIC_CONFIRMATION_CUES['create_group'] || [];
        }
        if (pending.type === 'invite_to_group') {
          actionSpecificConfirmations =
            ACTION_SPECIFIC_CONFIRMATION_CUES['invite_to_group'] || [];
        }

        const allConfirmationWords = [
          ...universalConfirmationPatterns,
          ...actionSpecificConfirmations,
        ];

        // Only treat as confirmation if:
        // 1. Text is SHORT (< 5 words for strict confirmation) OR
        // 2. Text starts with universal confirmation words
        const textWords = normalizedText.split(/\s+/).length;
        const startsWithConfirmation = universalConfirmationPatterns.some(
          (word) => new RegExp(`^${word}(\\s|$)`, 'i').test(normalizedText),
        );

        const isSimpleConfirmation =
          (textWords <= 4 || startsWithConfirmation) &&
          allConfirmationWords.some((word) => {
            // Check if word is at start or surrounded by spaces (or end of string)
            return new RegExp(
              `(^|\\s)${word.replace(/\s+/g, '\\s+')}(\\s|$)`,
              'i',
            ).test(normalizedText);
          });

        this.logger.log(
          `[classifyIntentWithLLM] Confirmation check: text="${text}", words=${textWords}, startsWithConfirm=${startsWithConfirmation}, shouldConfirm=${isSimpleConfirmation}`,
        );

        if (isSimpleConfirmation) {
          this.logger.log(
            `[classifyIntentWithLLM] ✅ Detected simple confirmation in: "${text}" (pending type: ${pending.type})`,
          );
          return {
            function: 'confirm_action',
            parameters: {},
            response: 'Đã xác nhận',
          };
        }

        // Cancellation words: no, không, hủy, cancel - MUST be more strict
        // Only match exact standalone words to avoid false positives
        const cancellationWords = ['no', 'không', 'hủy', 'cancel'];
        const isSimpleCancellation = cancellationWords.some((word) => {
          return new RegExp(`(^|\\s)${word}(\\s|$)`, 'i').test(normalizedText);
        });

        if (isSimpleCancellation) {
          this.logger.log(
            `[classifyIntentWithLLM] Detected simple cancellation word in: "${text}"`,
          );
          return {
            function: 'cancel_action',
            parameters: {},
            response: 'Đã hủy bỏ',
          };
        }
      }
    }

    // Fetch user's contacts (both direct chats and groups) for LLM reference
    this.logger.log(
      `[classifyIntentWithLLM] Fetching user contacts for LLM...`,
    );

    let contactsList = '';
    try {
      // Get direct chat contacts
      const directChats = await this.prisma.directChat.findMany({
        where: {
          OR: [{ creatorId: userId }, { recipientId: userId }],
        },
        include: {
          Creator: { select: { Profile: { select: { fullName: true } } } },
          Recipient: { select: { Profile: { select: { fullName: true } } } },
        },
      });

      // Get group chats where user is a member
      const groupChats = await this.prisma.groupChat.findMany({
        where: {
          Members: {
            some: { userId },
          },
        },
      });

      // Build contact list string for LLM
      const contacts: Array<{ type: string; name: string; id: number }> = [];

      // Add direct chat contacts
      for (const chat of directChats) {
        const otherUser =
          chat.creatorId === userId ? chat.Recipient : chat.Creator;
        contacts.push({
          type: 'direct',
          name: otherUser?.Profile?.fullName || 'Unknown',
          id: chat.id,
        });
      }

      // Add group chats
      for (const group of groupChats) {
        contacts.push({
          type: 'group',
          name: group.name,
          id: group.id,
        });
      }

      this.logger.log(
        `[classifyIntentWithLLM] Found ${contacts.length} contacts`,
      );

      // Log all contacts for debugging
      this.logger.log(`[classifyIntentWithLLM] Available contacts:`);
      for (const contact of contacts) {
        this.logger.log(
          `  - "${contact.name}" (${contact.type}, ID: ${contact.id})`,
        );
      }

      // Format contacts for prompt
      if (contacts.length > 0) {
        contactsList = 'Available contacts:\n';
        for (const contact of contacts) {
          contactsList += `- "${contact.name}" (${contact.type === 'group' ? 'group' : 'direct'}, ID: ${contact.id})\n`;
        }
      }
    } catch (err) {
      this.logger.warn(
        `[classifyIntentWithLLM] Error fetching contacts: ${(err as Error).message}`,
      );
      contactsList = ''; // Continue without contact list if fetching fails
    }

    // Build detailed context for LLM
    let pendingContext = '';
    if (pending) {
      pendingContext = `
IMPORTANT: User currently has a PENDING ACTION that needs confirmation or cancellation:
- Pending type: ${pending.type}
- Pending target: ${pending.targetName}
- Pending message: "${pending.lastBotMessage}"

CRITICAL INSTRUCTION: First check if user's new voice command is:
1. CONFIRMATION (ONLY simple yes/no words: "yes", "ok", "có", "ừ", "vâng", "được") → respond with confirm_action intent
2. CANCELLATION (ONLY simple no/cancel words: "no", "không", "hủy", "tạm dừng") → respond with cancel_action intent
3. NEW COMMAND (contains action keywords like "gửi", "gọi", "đọc", "tìm", "đổi") → respond with the NEW intent and COMPLETELY IGNORE the pending action

SPECIAL DETECTION RULES:
- If user says "gửi tin nhắn âm thanh" or "gửi voice" or "voice message" → NEW send_voice_message intent (NOT confirm_action)
- If user says "gọi" or "call" → NEW make_call intent (NOT confirm_action)
- If user says "đọc tin nhắn" or "read messages" → NEW read_latest_messages intent (NOT confirm_action)
- If user mentions a DIFFERENT contact name than pending → NEW intent (NOT confirm_action)

Only use confirm_action or cancel_action if user says SIMPLE confirmation/cancellation words WITHOUT any action keywords.
If there are ANY action keywords, treat it as a NEW command and ignore pending.`;
    }

    const promptTemplate = PromptTemplate.fromTemplate(`
You are a Vietnamese voice assistant for a chat app. Classify the user's intent from their voice command.

User said: "{text}"
{pendingContext}

{contactsList}

Available intents:
- check_new_messages: Check how many new messages
- read_latest_messages: Read out messages (optionally from specific contact)
- read_missed_calls: Read out missed calls history
- send_message: Send a text message to someone (requires contactName and content)
- send_voice_message: Send a voice message/audio to someone (requires contactName only)
- send_image: Send an image/photo to someone (requires contactName)
- send_document: Send a document/file to someone (requires contactName)
- send_file: Alias of send_document (requires contactName)
- send_sticker: Send a sticker by emotion/description (requires contactName and stickerEmotion)
- create_group: Create a new group chat (requires groupName and memberNames array)
- invite_to_group: Invite/add members to existing group (requires groupName and memberNames array)
- make_call: Make a voice/video call (requires contactName)
- search_message: Search for messages containing a keyword
- change_user_name: Change user's display name (requires new name)
- confirm_action: User confirms pending action (yes/ok/có)
- cancel_action: User cancels pending action (no/không/hủy)
- clarify: Cannot understand intent

EXTRACTION RULES:
- For send_message: 
  * Extract the EXACT contact name user mentioned in their voice (even if it has STT errors)
  * Extract content (message text user wants to send)
  * Return: contactName, content
  
- For send_voice_message:
  * Extract the EXACT contact name user mentioned
  * Return: contactName only

- For send_image:
  * Detect keywords like "gửi ảnh", "gửi hình", "image", "photo"
  * Extract the EXACT contact name user mentioned
  * Return: contactName only

- For send_document / send_file:
  * Detect keywords like "gửi tài liệu", "gửi file", "document"
  * Extract the EXACT contact name user mentioned
  * Return: contactName only
  
- For make_call:
  * Extract the EXACT contact name user mentioned
  * Detect if video or voice call (contains "video" or "gọi video" = video call)
  * Return: contactName, isVideo (true/false)
  * Example: "gọi cho new group" → contactName="new group", isVideo=false
  
- For read_latest_messages:
  * CRITICAL: ALWAYS scan the entire message for date keywords FIRST, before any other extraction
  * SCAN FOR: "hôm nay", "hôm qua", "ngày hôm nay", "ngày hôm qua", "ngày qua", "tuần trước", "tuần qua", "vào ngày" (these ALWAYS indicate a date context)
  * ALWAYS extract dateFilter if ANY date keyword is present (regardless of word position or sentence structure)
  * Date keyword matching:
    - "hôm nay", "ngày hôm nay" → dateFilter='today'
    - "hôm qua", "ngày hôm qua", "ngày qua" → dateFilter='yesterday'
    - "tuần trước", "tuần qua", "tuần trước đó" → dateFilter='last-week'
    - "vào ngày" + "hôm qua" anywhere in text → dateFilter='yesterday' (exact phrase order doesn't matter)
    - Specific dates like "30 tháng 11", "30/11", "30-11-2025", "ngày 30 tháng 11 năm 2025" → dateFilter='2025-11-30' (YYYY-MM-DD format)
  * If user mentions specific contact name, extract the contact name
  * Extract isMyMessages based on message direction (CRITICAL: This determines if reading SENT vs RECEIVED messages):
    - isMyMessages=true ONLY if: user explicitly says "tôi gửi", "tôi nhắn", "tôi vừa nói", "tôi nói" (messages I SENT)
    - isMyMessages=false for EVERYTHING ELSE: default behavior for reading messages (messages I RECEIVED)
    - IMPORTANT: If unclear or ambiguous, ALWAYS default to isMyMessages=false (received messages)
    - CRITICAL: Do NOT set isMyMessages=true unless you see explicit "tôi gửi/nhắn/nói" keywords
  * Extract messageCount: Any number based on "N tin", "N message", "N tin nhận" (e.g., "10 tin", "20 tin", "100 tin")
  * IMPORTANT: MUST check EVERY message for date keywords - do not skip dateFilter extraction even if word order is unusual
  * Return: contactName (optional), isMyMessages (optional, default=false), dateFilter (optional), messageCount (optional)
  * Examples:
    - "đọc tin nhắn hôm nay" → dateFilter='today', isMyMessages=false (default)
    - "đọc tin nhắn hôm qua" → dateFilter='yesterday', isMyMessages=false (default)
    - "đọc các tin nhắn vào ngày hôm qua mà tôi đã nhận" → dateFilter='yesterday', isMyMessages=false (vào ngày hôm qua = yesterday, tôi NHẬN = received)
    - "đọc 10 tin nhắn tôi nhận" → messageCount=10, isMyMessages=false
    - "đọc 100 tin nhắn" → messageCount=100, isMyMessages=false (default)
    - "đọc tin nhắn tuần trước" → dateFilter='last-week', isMyMessages=false
    - "đọc 200 tin nhắn hôm qua" → messageCount=200, dateFilter='yesterday', isMyMessages=false
    - "đọc các tin nhắn tôi đã nhận vào ngày hôm qua" → dateFilter='yesterday', isMyMessages=false (tôi NHẬN = received)
    - "các tin nhắn mà tôi đã nhận vào ngày hôm qua" → dateFilter='yesterday', isMyMessages=false (tôi NHẬN = received)
    - "đọc các tin nhắn tôi vừa gửi hôm qua" → dateFilter='yesterday', isMyMessages=true (tôi GỬI = sent)
    - "tôi vừa nhắn gì hôm nay" → dateFilter='today', isMyMessages=true (tôi NHẮN = sent)
    - "đọc tin nhắn ngày 30 tháng 11" → dateFilter='2025-11-30'
    - "đọc tin nhắn ngày 30 tháng 11 năm 2025" → dateFilter='2025-11-30'

- For read_missed_calls:
  * Detect keywords like "cuộc gọi nhỡ", "gọi nhỡ", "missed call", "đọc cuộc gọi"
  * No parameters needed
  * Return: empty parameters

- For send_sticker:
  * Extract the EXACT contact name user mentioned
  * Extract emotion/description: "cười", "khóc", "yêu", "buồn", "vui", "tức giận", etc.
  * Return: contactName, stickerEmotion
  * Examples:
    - "Gửi sticker cười cho Nicko" → contactName="Nicko", stickerEmotion="cười"
    - "Gửi sticker trái tim cho team Dev" → contactName="team Dev", stickerEmotion="trái tim"
    - "Gửi emoji vui cho Mai" → contactName="Mai", stickerEmotion="vui"

- For create_group:
  * Extract group name from voice command
  * Extract list of member names (array, minimum 1 person)
  * Return: groupName, memberNames (array of names)
  * Examples:
    - "Tạo nhóm Team Dev với Mai và Nicko" → groupName="Team Dev", memberNames=["Mai", "Nicko"]
    - "Tạo group Dự án X, thêm An, Bình, Châu" → groupName="Dự án X", memberNames=["An", "Bình", "Châu"]
    - "Lập nhóm Gia đình với ba, mẹ, em" → groupName="Gia đình", memberNames=["ba", "mẹ", "em"]

- For invite_to_group:
  * Detect keywords: "thêm", "mời", "add", "invite" combined with "nhóm", "group", "team"
  * Extract existing group name
  * Extract member names to add (array, can be 1 or multiple)
  * Return: groupName, memberNames (array of names)
  * Examples:
    - "Thêm Nguyễn Văn Thanh vào New Group" → groupName="New Group", memberNames=["Nguyễn Văn Thanh"]
    - "Mời Mai và Niko vào nhóm Dev" → groupName="Dev", memberNames=["Mai", "Niko"]
    - "Thêm ba, mẹ vào nhóm Gia đình" → groupName="Gia đình", memberNames=["ba", "mẹ"]
  
- For change_user_name: extract newName from the voice command
- For search_message: extract searchKeyword

IMPORTANT: When extracting contact names:
- Extract the EXACT name user mentioned, even with STT errors
- DON'T try to fuzzy match against available contacts list
- DON'T return contactId - the backend will do fuzzy matching via fuzzyFindContact service
- The backend fuzzyFindContact will handle matching errors and find the correct group/contact

Respond with JSON only:
{{
  "function": "intent_name",
  "parameters": {{
    "contactName": "exact name user mentioned (or empty string if not applicable)",
    "content": "optional message content for send_message",
    "newName": "optional new name for change_user_name",
    "searchKeyword": "optional keyword for search_message",
    "stickerEmotion": "optional emotion for send_sticker",
    "groupName": "optional group name for create_group or invite_to_group",
    "memberNames": ["optional array of member names for create_group or invite_to_group"],
    "dateFilter": "optional date filter: 'today', 'yesterday', 'last-week', or specific date",
    "messageCount": "optional message count: 10, 100, or 200",
    "isMyMessages": false,
    "isVideo": false
    "isVideo": false
  }},
  "response": "Vietnamese response to user"
}}
    `);

    const chain = RunnableSequence.from([
      promptTemplate,
      this.llm,
      new StringOutputParser(),
    ]);

    let resultText: string;
    try {
      console.log(`[LLM] Calling Gemini API with prompt...`);
      resultText = await chain.invoke({
        text,
        pendingContext,
        contactsList,
      });
      console.log(`[LLM] Gemini API call succeeded`);
    } catch (apiErr) {
      console.error(
        `[LLM API ERROR] Gemini call failed: ${(apiErr as Error).message}`,
      );
      console.error(`[LLM API ERROR] Full details:`, apiErr);
      throw apiErr;
    }

    console.log(`[LLM DEBUG] Raw LLM response for "${text}":`, resultText);

    // Parse JSON from response - extract JSON block from anywhere in the response
    let cleanedText = resultText.trim();

    // Try to find JSON block in markdown code blocks
    const jsonBlockMatch =
      cleanedText.match(/```json\s*\n([\s\S]*?)\n```/) ||
      cleanedText.match(/```\s*\n([\s\S]*?)\n```/);

    if (jsonBlockMatch) {
      cleanedText = jsonBlockMatch[1].trim();
    } else {
      // Try to find JSON object directly (starts with { and ends with })
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
    }

    const result = JSON.parse(cleanedText);

    // Ensure parameters object exists (safety check)
    if (!result.parameters) {
      result.parameters = {};
    }

    console.log(`[LLM DEBUG] Parsed result function: ${result.function}`);
    console.log(
      `[LLM DEBUG] Has dateFilter: ${!!result.parameters?.dateFilter}`,
    );

    console.log(
      `[LLM DEBUG] Initial parameters:`,
      JSON.stringify(result.parameters),
    );
    this.logger.log(`[LLM] Gemini classified intent: ${result.function}`);
    this.logger.log(`[LLM] Full result: ${JSON.stringify(result)}`);
    this.logger.log(`[LLM] Parameters: ${JSON.stringify(result.parameters)}`);
    this.logger.log(
      `[LLM] Extracted contactName: "${result.parameters?.contactName || '(EMPTY)'}"`,
    );

    // ===== POST-PROCESSING: FUZZY MATCH CONTACT IF EMPTY =====
    // If LLM extracted contactName, fuzzy search for the contact
    console.log(
      `[LLM DEBUG] POST-PROCESSING check: function=${result.function}, contactName="${result.parameters?.contactName || 'EMPTY'}", contactId="${result.parameters?.contactId || 'EMPTY'}"`,
    );
    this.logger.log(
      `[LLM] POST-PROCESSING check: function=${result.function}, contactName="${result.parameters?.contactName || 'EMPTY'}", contactId="${result.parameters?.contactId || 'EMPTY'}"`,
    );

    if (
      result.parameters?.contactName &&
      !result.parameters?.contactId &&
      (result.function === 'make_call' ||
        result.function === 'send_message' ||
        result.function === 'send_voice_message' ||
        result.function === 'send_image' ||
        result.function === 'send_document' ||
        result.function === 'send_file' ||
        result.function === 'send_sticker')
    ) {
      const contactName = result.parameters.contactName;

      if (contactName) {
        this.logger.log(
          `[LLM] POST-PROCESSING: Attempting fuzzy match for contact: "${contactName}"`,
        );
        try {
          const contact = await this.fuzzySearchService.fuzzyFindContact(
            userId,
            contactName,
          );
          console.log('[LLM] contact type :', contact);
          if (contact) {
            // Set contactId and contactType from fuzzy match result
            if (contact.type === 'group') {
              result.parameters.contactId = String(contact.groupId);
              result.parameters.contactType = 'group';
            } else if (contact.type === 'direct') {
              result.parameters.contactId = String(contact.directChatId);
              result.parameters.contactType = 'direct';
            }
            this.logger.log(
              `[LLM] POST-PROCESSING: Matched "${contactName}" to ID: ${result.parameters.contactId} (type: ${contact.type})`,
            );
          } else {
            this.logger.log(
              `[LLM] POST-PROCESSING: No fuzzy match found for "${contactName}"`,
            );
          }
        } catch (err) {
          this.logger.warn(
            `[LLM] POST-PROCESSING: Fuzzy match error: ${(err as Error).message}`,
          );
        }
      }
    } else {
      this.logger.log(
        `[LLM] POST-PROCESSING: Skipped (contactName empty or contactId already set)`,
      );
    }

    // ===== FALLBACK: Extract contactName from text if LLM didn't provide it =====
    if (
      !result.parameters?.contactName &&
      !result.parameters?.contactId &&
      (result.function === 'make_call' ||
        result.function === 'send_message' ||
        result.function === 'send_voice_message' ||
        result.function === 'send_image' ||
        result.function === 'send_document' ||
        result.function === 'send_file' ||
        result.function === 'send_sticker')
    ) {
      let contactName = '';

      // Extract contact name based on function type
      if (result.function === 'make_call') {
        // Match: gọi + optional "cho" + group/contact name (capture everything until end or video/thoại)
        const callMatch = text.match(
          /gọi\s+(?:cho\s+)?([a-záàảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđA-Z0-9\s]+?)(?:\s+(?:video|thoại|điện))?$/i,
        );
        if (callMatch?.[1]) {
          contactName = callMatch[1].trim();
        }
      } else if (
        result.function === 'send_message' ||
        result.function === 'send_voice_message'
      ) {
        // Match: gửi + optional "tin/nhắn" + optional "cho/đến" + name + content
        // Need to find where name ends and content begins (usually a verb or action)
        const sendMatch = text.match(
          /(?:gửi|send)\s+(?:tin\s+|nhắn\s+)?(?:cho|đến)?\s*([a-záàảãạăằắẳẵặâầấẩẫậèéẻẽẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđA-Z0-9\s]+?)\s+(?:là|gì|cái|chiếc|em|anh|chị|ơi)/i,
        );
        if (sendMatch?.[1]) {
          contactName = sendMatch[1].trim();
        }
      } else if (result.function === 'send_image') {
        const imgMatch = text.match(
          /(?:gửi|send)\s+(?:ảnh|hình|image)\s*(?:cho|đến)?\s*([a-záàảãạăằắẳẵặâầấẩẫậèéẻẽẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđA-Z0-9\s]+?)$/i,
        );
        if (imgMatch?.[1]) {
          contactName = imgMatch[1].trim();
        }
      } else if (
        result.function === 'send_document' ||
        result.function === 'send_file'
      ) {
        const docMatch = text.match(
          /(?:gửi|send)\s+(?:tài\s+liệu|file|document)\s*(?:cho|đến)?\s*([a-záàảãạăằắẳẵặâầấẩẫậèéẻẽẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđA-Z0-9\s]+?)$/i,
        );
        if (docMatch?.[1]) {
          contactName = docMatch[1].trim();
        }
      } else if (result.function === 'send_sticker') {
        const stickerMatch = text.match(
          /(?:gửi|send)\s+(?:sticker|emoji)\s+\w+\s*(?:cho|đến)?\s*([a-záàảãạăằắẳẵặâầấẩẫậèéẻẽẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđA-Z0-9\s]+?)$/i,
        );
        if (stickerMatch?.[1]) {
          contactName = stickerMatch[1].trim();
        }
      }

      if (contactName) {
        this.logger.log(
          `[LLM] FALLBACK: Extracted contactName from text: "${contactName}"`,
        );
        try {
          const contact = await this.fuzzySearchService.fuzzyFindContact(
            userId,
            contactName,
          );

          if (contact) {
            if (contact.type === 'group') {
              result.parameters.contactId = String(contact.groupId);
            } else if (contact.type === 'direct') {
              result.parameters.contactId = String(contact.directChatId);
            }
            this.logger.log(
              `[LLM] FALLBACK: Matched "${contactName}" to ID: ${result.parameters.contactId} (type: ${contact.type})`,
            );
          } else {
            this.logger.warn(
              `[LLM] FALLBACK: No match found for "${contactName}"`,
            );
          }
        } catch (err) {
          this.logger.warn(`[LLM] FALLBACK: Error: ${(err as Error).message}`);
        }
      } else {
        this.logger.warn(
          `[LLM] FALLBACK: Could not extract contactName from text: "${text}" for function: ${result.function}`,
        );
      }
    }

    // ===== FALLBACK: Extract dateFilter from text for read_latest_messages =====
    console.log(
      `[LLM DEBUG] Before fallback dateFilter: function=${result.function}, hasDateFilter=${!!result.parameters?.dateFilter}, dateFilterValue="${result.parameters?.dateFilter}"`,
    );
    if (
      result.function === 'read_latest_messages' &&
      !result.parameters?.dateFilter
    ) {
      const textLower = text.toLowerCase();
      console.log(
        `[LLM DEBUG] FALLBACK dateFilter: Entering. text="${text}", textLower="${textLower}"`,
      );
      this.logger.log(`[LLM] FALLBACK dateFilter: Entering. Text: "${text}"`);

      // Check for date keywords
      if (
        textLower.includes('hôm qua') ||
        textLower.includes('ngày hôm qua') ||
        textLower.includes('ngày qua')
      ) {
        result.parameters.dateFilter = 'yesterday';
        console.log(
          `[LLM DEBUG] ✅ Matched "hôm qua" → dateFilter='yesterday'`,
        );
        this.logger.log(
          `[LLM] FALLBACK dateFilter: ✅ Matched "hôm qua" → dateFilter='yesterday'`,
        );
      } else if (
        textLower.includes('hôm nay') ||
        textLower.includes('ngày hôm nay') ||
        textLower.includes('today')
      ) {
        result.parameters.dateFilter = 'today';
        this.logger.log(
          `[LLM] FALLBACK dateFilter: ✅ Matched "hôm nay" → dateFilter='today'`,
        );
      } else if (
        textLower.includes('tuần trước') ||
        textLower.includes('tuần qua') ||
        textLower.includes('last week') ||
        textLower.includes('last-week')
      ) {
        result.parameters.dateFilter = 'last-week';
        this.logger.log(
          `[LLM] FALLBACK dateFilter: ✅ Matched "tuần trước" → dateFilter='last-week'`,
        );
      } else {
        // Try to extract specific date: "ngày 30 tháng 11 năm 2025" or "30/11/2025" or "30-11-2025"
        // Pattern 1: "ngày DD tháng MM năm YYYY" or "ngày DD tháng MM"
        let dateMatch = text.match(
          /ngày\s+(\d{1,2})\s+tháng\s+(\d{1,2})(?:\s+năm\s+(\d{4}))?/i,
        );
        if (dateMatch) {
          const day = dateMatch[1].padStart(2, '0');
          const month = dateMatch[2].padStart(2, '0');
          const year = dateMatch[3] || new Date().getFullYear();
          result.parameters.dateFilter = `${year}-${month}-${day}`;
          this.logger.log(
            `[LLM] FALLBACK: Extracted dateFilter='${result.parameters.dateFilter}' from text (pattern: ngày DD tháng MM)`,
          );
        } else {
          // Pattern 2: "DD/MM/YYYY" or "DD/MM"
          dateMatch = text.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
          if (dateMatch) {
            const day = dateMatch[1].padStart(2, '0');
            const month = dateMatch[2].padStart(2, '0');
            const year = dateMatch[3] || new Date().getFullYear();
            result.parameters.dateFilter = `${year}-${month}-${day}`;
            this.logger.log(
              `[LLM] FALLBACK: Extracted dateFilter='${result.parameters.dateFilter}' from text (pattern: DD/MM/YYYY)`,
            );
          } else {
            // Pattern 3: "DD-MM-YYYY" or "DD-MM"
            dateMatch = text.match(/(\d{1,2})-(\d{1,2})(?:-(\d{4}))?/);
            if (dateMatch) {
              const day = dateMatch[1].padStart(2, '0');
              const month = dateMatch[2].padStart(2, '0');
              const year = dateMatch[3] || new Date().getFullYear();
              result.parameters.dateFilter = `${year}-${month}-${day}`;
              this.logger.log(
                `[LLM] FALLBACK: Extracted dateFilter='${result.parameters.dateFilter}' from text (pattern: DD-MM-YYYY)`,
              );
            }
          }
        }
      }
    }

    // ===== FALLBACK: Extract messageCount from text for read_latest_messages =====
    if (
      result.function === 'read_latest_messages' &&
      !result.parameters?.messageCount
    ) {
      const textLower = text.toLowerCase();

      // Check for message count pattern: "<number> tin/tin nhắn/message"
      const messageCountMatch = textLower.match(
        /(\d+)\s*(tin nhắn|tin|message)/i,
      );
      if (messageCountMatch) {
        const count = parseInt(messageCountMatch[1]);
        if (count > 0 && count <= 1000) {
          // Reasonable limit
          result.parameters.messageCount = count;
          this.logger.log(
            `[LLM] FALLBACK: Extracted messageCount=${count} from text`,
          );
        }
      }
    }

    // ===== FALLBACK: Fix isMyMessages for read_latest_messages =====
    // CRITICAL: Only fill in isMyMessages if LLM didn't provide it
    // Do NOT override LLM-extracted values with fallback defaults
    if (
      result.function === 'read_latest_messages' &&
      !result.parameters?.isMyMessages
    ) {
      const textLower = text.toLowerCase();

      // Keywords for RECEIVED messages (isMyMessages should be FALSE)
      const receivedKeywords = [
        'tôi nhận',
        'tôi được gửi',
        'gửi cho tôi',
        'gửi tới tôi',
        'nhận được',
        'nhận',
        'nhờ', // Common STT error for "nhận"
        'received',
      ];

      // Keywords for SENT messages (isMyMessages should be TRUE)
      const sentKeywords = [
        'tôi gửi',
        'tôi vừa nhắn',
        'tôi nhắn',
        'tôi nói',
        'sent',
        'i sent',
      ];

      // Check if text contains received keywords → set isMyMessages=false
      if (receivedKeywords.some((kw) => textLower.includes(kw))) {
        this.logger.log(
          `[LLM] FALLBACK isMyMessages: Text contains 'received' keyword, setting isMyMessages=false`,
        );
        result.parameters.isMyMessages = false;
      }
      // Check if text contains sent keywords → set isMyMessages=true
      else if (sentKeywords.some((kw) => textLower.includes(kw))) {
        this.logger.log(
          `[LLM] FALLBACK isMyMessages: Text contains 'sent' keyword, setting isMyMessages=true`,
        );
        result.parameters.isMyMessages = true;
      }
      // If neither keyword found, default to false (received messages)
      else {
        this.logger.log(
          `[LLM] FALLBACK isMyMessages: No keyword found, defaulting to isMyMessages=false`,
        );
        result.parameters.isMyMessages = false;
      }
    } else if (result.function === 'read_latest_messages') {
      // LLM already provided isMyMessages value - preserve it
      this.logger.log(
        `[LLM] FALLBACK isMyMessages: LLM provided value isMyMessages=${result.parameters.isMyMessages}, preserving it`,
      );
    }

    // ===== HEURISTIC OVERRIDE =====
    // If LLM returns send_voice_message but text contains call keywords, override to make_call
    const callKeywordsForOverride = [
      'gọi',
      'rọi',
      'goi',
      'call',
      'alo',
      'gọi điện',
      'gọi đến',
      'gọi video',
    ];
    if (
      result.function === 'send_voice_message' &&
      callKeywordsForOverride.some((kw) => text.toLowerCase().includes(kw))
    ) {
      this.logger.log(
        `[LLM] Heuristic override: text contains call keywords, changing send_voice_message → make_call`,
      );
      result.function = 'make_call';
      result.parameters.isVideo = text.toLowerCase().includes('video');
      result.response = `Gọi ${result.parameters.isVideo ? 'video' : 'thoại'}`;
    }

    // ===== HEURISTIC OVERRIDE FOR INVITE_TO_GROUP =====
    // If LLM returns send_message OR create_group but text contains invite/add keywords + group name, override to invite_to_group
    const inviteKeywordsForOverride = [
      'thêm',
      'mời',
      'add',
      'invite',
      'thêm vào',
      'mời vào',
      'thêm người',
      'mời người',
    ];
    const groupIndicators = ['group', 'nhóm', 'team', 'tem'];

    if (
      (result.function === 'send_message' ||
        result.function === 'create_group' ||
        result.function === 'clarify') &&
      inviteKeywordsForOverride.some((kw) => text.toLowerCase().includes(kw)) &&
      groupIndicators.some((gi) => text.toLowerCase().includes(gi))
    ) {
      this.logger.log(
        `[LLM] Heuristic override: text contains invite + group keywords, changing ${result.function} → invite_to_group (${text})`,
      );
      this.logger.log(
        `[LLM] Original LLM result: contactId=${result.parameters?.contactId}, content=${result.parameters?.content}`,
      );

      // Try to extract member name and group name from text
      // Pattern: "[thêm|mời] [tên người] vào [nhóm|group|tem] [tên nhóm]"
      // Also handle case where group name is just "group" or missing
      let memberName = result.parameters?.content || '';
      let groupName = '';

      // Try pattern 1: "thêm [member] vào [nhóm/group/team] [optional group name]"
      let memberAndGroupMatch = text.match(
        /(?:thêm|mời|add|invite)\s+(.+?)\s+(?:vào|to|into)?\s*(?:nhóm|group|team|tem)(?:\s+(.+?))?(?:\s+$|$)/i,
      );

      if (memberAndGroupMatch && memberAndGroupMatch[1]) {
        memberName = memberAndGroupMatch[1].trim();
        groupName = memberAndGroupMatch[2]?.trim() || 'group';
        this.logger.log(
          `[LLM] Extracted from text (pattern 1): memberName="${memberName}", groupName="${groupName}"`,
        );
      } else {
        // Try pattern 2: "thêm [member] vào group [group name]" (more explicit)
        memberAndGroupMatch = text.match(
          /(?:thêm|mời|add|invite)\s+(.+)\s+(?:vào|to|into)?\s*(?:nhóm|group|team|tem)?(?:\s+(.+))?/i,
        );
        if (memberAndGroupMatch && memberAndGroupMatch[1]) {
          // Extract member name - everything before "vào/group"
          const beforeGroup = memberAndGroupMatch[1];
          const groupKeywordMatch = beforeGroup.match(
            /^(.+?)\s+(?:vào|to|into|nhóm|group|team|tem)/i,
          );
          memberName = groupKeywordMatch
            ? groupKeywordMatch[1].trim()
            : beforeGroup.trim();
          groupName = memberAndGroupMatch[2]?.trim() || 'group';
          this.logger.log(
            `[LLM] Extracted from text (pattern 2): memberName="${memberName}", groupName="${groupName}"`,
          );
        } else {
          this.logger.log(
            `[LLM] Could not extract member/group names from text using regex. Using LLM parameters as fallback.`,
          );
        }
      }

      result.function = 'invite_to_group';
      result.parameters = {
        ...result.parameters,
        memberNames: [memberName],
        groupName: groupName || result.parameters?.groupName || 'group',
      };
      result.response = `Mời ${memberName} vào nhóm ${groupName}`;
    }

    // ===== HEURISTIC OVERRIDE FOR JOIN_GROUP =====
    // If LLM returns send_message OR create_group but text contains join keywords + group name, override to join_group
    const joinKeywordsForOverride = [
      'tham gia',
      'gia nhập',
      'join',
      'tham gia vào',
      'gia nhập vào',
    ];

    if (
      (result.function === 'send_message' ||
        result.function === 'create_group') &&
      joinKeywordsForOverride.some((kw) => text.toLowerCase().includes(kw)) &&
      groupIndicators.some((gi) => text.toLowerCase().includes(gi))
    ) {
      this.logger.log(
        `[LLM] Heuristic override: text contains join + group keywords, changing ${result.function} → join_group`,
      );
      this.logger.log(
        `[LLM] Original LLM result: contactId=${result.parameters?.contactId}, content=${result.parameters?.content}`,
      );

      // Try to extract group name from text
      // Pattern: "[tham gia|gia nhập] [vào] [nhóm|group|tem] [tên nhóm]"
      const joinGroupMatch = text.match(
        /(?:tham\s+gia|gia\s+nhập|join)\s+(?:vào|to|into)?\s+(?:nhóm|group|team|tem)\s+(.+)/i,
      );

      let groupName = '';

      if (joinGroupMatch) {
        groupName = joinGroupMatch[1].trim();
        this.logger.log(`[LLM] Extracted from text: groupName="${groupName}"`);
      }

      result.function = 'join_group';
      result.parameters = {
        ...result.parameters,
        groupName: groupName || result.parameters?.groupName || 'group',
      };
      result.response = `Tham gia nhóm ${groupName}`;
    }

    // ===== HEURISTIC OVERRIDE FOR SEND_STICKER =====
    // If LLM returns send_message but text contains sticker/emoji keywords + "gửi/send", override to send_sticker
    const stickerSendKeywords = [
      'gửi sticker',
      'gửi emoji',
      'gửi mặt',
      'gửi cười',
      'send sticker',
      'send emoji',
    ];

    const hasStickerKeyword = stickerSendKeywords.some((kw) =>
      text.toLowerCase().includes(kw),
    );
    this.logger.log(
      `[LLM] DEBUG send_sticker check: result.function="${result.function}", hasStickerKeyword=${hasStickerKeyword}, text="${text}"`,
    );

    if (result.function === 'send_message' && hasStickerKeyword) {
      this.logger.log(
        `[LLM] Heuristic override: text contains sticker/emoji send keywords, changing send_message → send_sticker`,
      );
      this.logger.log(
        `[LLM] Original LLM result: contactId=${result.parameters?.contactId}, content=${result.parameters?.content}`,
      );

      // Try to extract emotion from text
      // Pattern: "gửi sticker [emotion] đến [contact]"
      const emotionMatch = text.match(
        /gửi\s+(?:sticker|emoji|mặt\s+cười|cười)\s+(.+?)\s+(?:đến|cho|to)/i,
      );

      let emotion = '';

      if (emotionMatch) {
        emotion = emotionMatch[1].trim();
        this.logger.log(`[LLM] Extracted from text: emotion="${emotion}"`);
      }

      // Try to extract recipient name from text
      // Pattern: "gửi sticker ... đến/cho [contact name]"
      const recipientMatch = text.match(/(?:đến|cho)\s+(.+?)(?:\s+vào\s+|$)/i);

      let recipientName = '';

      if (recipientMatch) {
        recipientName = recipientMatch[1].trim();
        this.logger.log(
          `[LLM] Extracted from text: recipientName="${recipientName}"`,
        );
      }

      result.function = 'send_sticker';
      result.parameters = {
        ...result.parameters,
        emotion: emotion || result.parameters?.emotion || 'happy',
        contactName:
          recipientName ||
          result.parameters?.contactName ||
          result.parameters?.content,
      };
      result.response = `Gửi sticker ${emotion} đến ${recipientName || 'người'}`;
    }

    // ===== FINAL LOG BEFORE RETURN =====
    console.log(
      `[LLM DEBUG] FINAL RESULT: function=${result.function}, dateFilter=${result.parameters?.dateFilter}, isMyMessages=${result.parameters?.isMyMessages}, messageCount=${result.parameters?.messageCount}`,
    );
    console.log(
      `[LLM DEBUG] FINAL full parameters: ${JSON.stringify(result.parameters)}`,
    );
    this.logger.log(
      `[LLM] FINAL RESULT: function=${result.function}, dateFilter=${result.parameters?.dateFilter || '(EMPTY)'}, isMyMessages=${result.parameters?.isMyMessages || '(EMPTY)'}, messageCount=${result.parameters?.messageCount || '(EMPTY)'}`,
    );

    return result;
  }

  private async classifyIntentWithRules(
    text: string,
    pending: any,
  ): Promise<LlmResult> {
    this.logger.warn(
      'LLM: Using rule-based intent matching (set GEMINI_API_KEY for better accuracy)',
    );

    const lowerText = text.toLowerCase().trim();

    // Fuzzy keywords for Vietnamese voice commands
    const readKeywords = [
      'đọc',
      'read',
      'nói cho tôi',
      'lại cho tôi',
      'mới nhất',
      'mới',
    ];
    const myMessagesKeywords = [
      'tôi vừa nhắn gì',
      'tôi vừa nói gì',
      'tôi nói gì',
      'tôi nhắn gì',
      'tin nhắn của tôi',
      'tôi gửi gì',
    ];
    const checkKeywords = ['kiểm tra', 'có tin nhắn', 'tin tức', 'check'];
    const missedCallKeywords = [
      'cuộc gọi nhỡ',
      'gọi nhỡ',
      'missed call',
      'đọc cuộc gọi',
      'lịch sử cuộc gọi',
    ];
    const sendKeywords = [
      'gửi',
      'send',
      'nhắn tin',
      'nhắn',
      'tin',
      'dán',
      'gõ',
      'viết',
    ];
    const imageKeywords = ['gửi ảnh', 'gửi hình', 'image', 'photo', 'hình'];
    const documentKeywords = [
      'gửi tài liệu',
      'gửi file',
      'document',
      'tài liệu',
      'file',
    ];
    const callKeywords = [
      'gọi',
      'call',
      'gọi điện',
      'gọi đến',
      'gọi video',
      'video call',
    ];

    // ===== PENDING ACTION HANDLING =====
    if (pending) {
      const yesKeywords = [
        'có',
        'ok',
        'ừ',
        'vâng',
        'đồng ý',
        'gửi',
        'gửi đi',
        'yes',
        'được',
        'bắt máy',
        'nghe máy',
        'oke',
      ];
      const noKeywords = [
        'không',
        'hủy',
        'no',
        'tạm dừng',
        'đợi',
        'chưa',
        'từ chối',
      ];

      if (yesKeywords.some((kw) => lowerText.includes(kw))) {
        return {
          function: 'confirm_action',
          parameters: {},
          response: 'Đã xác nhận',
        };
      }

      if (noKeywords.some((kw) => lowerText.includes(kw))) {
        return {
          function: 'cancel_action',
          parameters: {},
          response: 'Đã hủy',
        };
      }

      return {
        function: 'clarify',
        parameters: {},
        response: `${pending.lastBotMessage} Vui lòng trả lời "có" hoặc "không".`,
      };
    }

    // ===== NEW COMMAND HANDLING =====
    if (myMessagesKeywords.some((kw) => lowerText.includes(kw))) {
      return {
        function: 'read_latest_messages',
        parameters: { isMyMessages: true },
        response: 'Tin nhắn bạn vừa gửi',
      };
    }

    if (readKeywords.some((kw) => lowerText.includes(kw))) {
      return {
        function: 'read_latest_messages',
        parameters: {},
        response: 'Đọc tin nhắn mới nhất',
      };
    }

    if (checkKeywords.some((kw) => lowerText.includes(kw))) {
      return {
        function: 'check_new_messages',
        parameters: {},
        response: 'Kiểm tra tin nhắn mới',
      };
    }

    if (missedCallKeywords.some((kw) => lowerText.includes(kw))) {
      return {
        function: 'read_missed_calls',
        parameters: {},
        response: 'Đọc các cuộc gọi nhỡ',
      };
    }

    if (callKeywords.some((kw) => lowerText.includes(kw))) {
      const isVideo = lowerText.includes('video');
      return {
        function: 'make_call',
        parameters: { isVideo },
        response: `Gọi ${isVideo ? 'video' : 'thoại'}`,
      };
    }

    if (sendKeywords.some((kw) => lowerText.includes(kw))) {
      return {
        function: 'send_message',
        parameters: {},
        response: 'Gửi tin nhắn',
      };
    }

    if (imageKeywords.some((kw) => lowerText.includes(kw))) {
      return {
        function: 'send_image',
        parameters: {},
        response: 'Gửi ảnh',
      };
    }

    if (documentKeywords.some((kw) => lowerText.includes(kw))) {
      return {
        function: 'send_document',
        parameters: {},
        response: 'Gửi tài liệu',
      };
    }

    // Default: clarify
    return {
      function: 'clarify',
      parameters: {},
      response: 'Xin lỗi, tôi không hiểu. Bạn có thể nói lại được không?',
    };
  }

  /**
   * Normalize emotion text using LLM
   * Example: "mặt bồn" → "buồn", "tức tội" → "tức giận"
   */
  async normalizeEmotion(emotion: string): Promise<string> {
    try {
      const prompt = new PromptTemplate({
        template: `You are an emotion normalizer for Vietnamese text. 
The user said: "{emotion}"
This might be a transcription error or a variation of an emotion word.
Common Vietnamese emotions: cười, khóc, yêu, vui, buồn, tức, giận, ok, được, tim, mèo, chó, hoa, ăn, ngủ, chào, bye

Correct this to the most similar emotion word from the list above. Return ONLY the single word, nothing else.
For example:
- "mặt bồn" → buồn
- "tức tội" → tức
- "smile" → cười`,
        inputVariables: ['emotion'],
      });

      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
      const result = await chain.invoke({ emotion });
      const normalized = result.trim().toLowerCase();

      // Validate the result is a real emotion word
      const validEmotions = [
        'cười',
        'khóc',
        'yêu',
        'vui',
        'buồn',
        'tức',
        'giận',
        'ok',
        'được',
        'tim',
        'mèo',
        'chó',
        'hoa',
        'ăn',
        'ngủ',
        'chào',
        'bye',
      ];
      if (validEmotions.includes(normalized)) {
        return normalized;
      }

      // If invalid, return original
      return emotion;
    } catch (error) {
      // On error, return original emotion
      return emotion;
    }
  }

  /**
   * Detect if a term refers to the speaker (self pronoun) in Vietnamese, accounting for ASR errors.
   * Returns true if it's likely a self reference like "tôi/mình/tui/tớ/tao".
   */
  async isSelfPronoun(term: string): Promise<boolean> {
    try {
      const prompt = new PromptTemplate({
        template: `You are a Vietnamese ASR fixer. Decide if the input refers to the speaker (first-person pronoun).
Input: "{term}"
Examples mapping to SELF: "tôi", "toi", "tooi", "mình", "tớ", "tui", "tao", "ta"
Examples mapping to OTHER: person names like "niko", "anh", "chị", "em" (ambiguous), or anything else.
Answer strictly with YES or NO.`,
        inputVariables: ['term'],
      });

      const chain = prompt.pipe(this.llm).pipe(new StringOutputParser());
      const result = await chain.invoke({ term });
      const ans = result.trim().toLowerCase();
      return ans.startsWith('y');
    } catch {
      return false;
    }
  }

  /**
   * Use LLM to select the best matching sticker from a list
   */
  async callLLMForSticker(prompt: string): Promise<string> {
    try {
      if (!process.env.GEMINI_API_KEY) {
        return '';
      }

      const response = await this.llm.invoke(prompt);
      const result =
        typeof response.content === 'string'
          ? response.content
          : String(response.content);
      return result.trim();
    } catch (error) {
      this.logger.warn(`[callLLMForSticker] LLM call failed: ${error.message}`);
      return '';
    }
  }
}
