/**
 * Voice Assistant Cue Strings
 * Collection of common voice command patterns for detection and parsing
 */

/**
 * Cues indicating user's own messages
 * Used to filter messages FROM the user (isMyMessages = true)
 */
export const MY_MESSAGES_CUES = [
  'tôi vừa nhắn',
  'tôi vừa gửi',
  'tôi nhắn gì',
  'tôi gửi gì',
  'tin nhắn của tôi',
  'của tôi',
  'mình vừa nhắn',
  'tui vừa nhắn',
];

/**
 * Cues indicating confirmation/affirmation
 * Universal confirmation words accepted across all action types
 */
export const UNIVERSAL_CONFIRMATION_CUES = [
  'có',
  'ừ',
  'vâng',
  'được',
  'đồng ý',
  'đúng',
  'đúng rồi',
  'yes',
  'ok',
];

/**
 * Action-specific confirmation cues
 * Additional confirmation patterns for specific action types
 */
export const ACTION_SPECIFIC_CONFIRMATION_CUES: Record<string, string[]> = {
  send_message: ['gửi đi', 'gửi thôi', 'gửi luôn'],
  send_voice_message: ['gửi đi', 'gửi thôi', 'gửi luôn'],
  make_call: ['gọi đi', 'gọi thôi', 'gọi luôn'],
  create_group: ['tạo đi', 'tạo thôi', 'tạo luôn'],
  invite_to_group: ['mời đi', 'mời thôi', 'mời luôn'],
  send_sticker: ['gửi đi', 'gửi thôi', 'gửi luôn'],
  send_image: ['gửi đi', 'gửi thôi', 'gửi luôn'],
  send_document: ['gửi đi', 'gửi thôi', 'gửi luôn'],
  send_file: ['gửi đi', 'gửi thôi', 'gửi luôn'],
};

/**
 * Cues indicating cancellation/rejection
 */
export const CANCELLATION_CUES = [
  'không',
  'không cần',
  'hủy',
  'thôi',
  'bỏ',
  'bỏ qua',
  'thoát',
  'quên đi',
  'không gửi',
  'không gọi',
  'no',
  'cancel',
];

/**
 * Prepositions that should prevent confirmation detection
 * If text contains these before action words, treat as new intent not confirmation
 */
export const CONFIRMATION_BLOCKING_PREPOSITIONS = [
  'cho', // "cho ai" = to whom (new intent)
  'vào', // "vào group" = into group (new intent)
  'tới', // "tới ai" = to whom (new intent)
  'từ', // "từ ai" = from whom (new intent)
];

/**
 * Keywords indicating group references in voice commands
 */
export const GROUP_KEYWORDS = [
  'group',
  'nhóm',
  'team',
  'lớp',
  'hội nhóm',
  'tổ',
  'ban',
  'phòng',
];

/**
 * Keywords indicating member/user references in invite_to_group context
 */
export const MEMBER_REFERENCE_KEYWORDS = [
  'mời',
  'thêm',
  'vào',
  'tham gia',
  'cho tham gia',
  'nạp vào',
];

/**
 * Common emotion/sentiment keywords for sticker search
 * Mapped to sticker categories
 */
export const EMOTION_KEYWORDS: Record<string, string[]> = {
  happy: ['vui', 'cười', 'hạnh phúc', 'vừa ý', 'thoải mái'],
  sad: ['buồn', 'tuyệt vọng', 'khó chịu', 'nản', 'chán'],
  angry: ['tức', 'giận', 'nổi giận', 'phẫn nộ', 'gắt'],
  love: ['yêu', 'thích', 'mê', 'ưa thích', 'tình cảm'],
  sleep: ['ngủ', 'buồn ngủ', 'mệt', 'chán nảy', 'gục đầu'],
  eat: ['ăn', 'no', 'đói', 'bữa ăn', 'chén'],
  work: ['làm việc', 'bận rộn', 'công việc', 'áp lực', 'stress'],
};
