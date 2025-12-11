// Core emotion keywords mapping
const EMOTION_KEYWORDS: Record<string, string[]> = {
  cười: ['happy', 'smile', 'joy', 'funny', 'laugh'],
  khóc: ['sad', 'cry', 'tears', 'crying'],
  yêu: ['love', 'heart', 'kiss', 'romantic'],
  vui: ['happy', 'joy', 'excited', 'cheerful'],
  buồn: ['sad', 'depressed', 'unhappy', 'down'],
  tức: ['angry', 'mad'],
  giận: ['angry', 'mad'],
  ok: ['thumbs-up', 'good', 'nice', 'okay'],
  được: ['thumbs-up', 'okay', 'agree'],
  tim: ['love', 'heart'],
  mèo: ['cat', 'kitty'],
  chó: ['dog', 'puppy'],
  hoa: ['flower', 'rose', 'bloom'],
  ăn: ['food', 'eat', 'hungry'],
  ngủ: ['sleep', 'tired', 'sleepy'],
  chào: ['hello', 'hi', 'greeting', 'wave'],
  bye: ['bye', 'goodbye', 'farewell'],
  // English fallbacks
  happy: ['happy', 'smile', 'joy'],
  sad: ['sad', 'cry', 'unhappy'],
  love: ['love', 'heart', 'kiss'],
  angry: ['angry', 'mad', 'rage'],
};

// Multi-word phrases that contain core emotions
const EMOTION_PHRASES: Record<string, string> = {
  'mặt buồn': 'buồn',
  'tức giận': 'giận',
  'trái tim': 'tim',
  'động vật': 'mèo', // Default to cat
  'tạm biệt': 'bye',
};

export const EMOTION_TO_CATEGORY_MAP = EMOTION_KEYWORDS;

export function getEmotionKeywords(emotion: string): string[] {
  const normalized = emotion.toLowerCase().trim();

  // Check exact match first
  if (EMOTION_KEYWORDS[normalized]) {
    return EMOTION_KEYWORDS[normalized];
  }

  // Check phrase mapping
  if (EMOTION_PHRASES[normalized]) {
    const coreEmotion = EMOTION_PHRASES[normalized];
    return EMOTION_KEYWORDS[coreEmotion] || [coreEmotion];
  }

  // Extract core emotion from phrase (search for any core emotion keyword in the input)
  for (const [key, value] of Object.entries(EMOTION_KEYWORDS)) {
    if (normalized.includes(key)) {
      return value;
    }
  }

  // Fallback: return the emotion as-is
  return [normalized];
}
