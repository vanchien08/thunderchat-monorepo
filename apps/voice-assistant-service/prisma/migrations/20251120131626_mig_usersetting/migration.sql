-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "voice_activation_mode" TEXT NOT NULL DEFAULT 'LONG_PRESS',
ADD COLUMN     "wake_word_phrase" TEXT NOT NULL DEFAULT 'Hey Chat';
