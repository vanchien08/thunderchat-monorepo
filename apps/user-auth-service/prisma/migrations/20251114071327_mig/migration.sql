/*
  Warnings:

  - You are about to drop the column `user_id` on the `message_mappings` table. All the data in the column will be lost.
  - You are about to drop the `voice_call_sessions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[version_code]` on the table `message_mappings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `dek` to the `message_mappings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `version_code` to the `message_mappings` table without a default value. This is not possible if the table is not empty.
  - Made the column `mappings` on table `message_mappings` required. This step will fail if there are existing NULL values in that column.
  - Added the required column `auth_tag` to the `message_medias` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dek` to the `message_medias` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dek_version_code` to the `message_medias` table without a default value. This is not possible if the table is not empty.
  - Added the required column `file_type` to the `message_medias` table without a default value. This is not possible if the table is not empty.
  - Added the required column `iv` to the `message_medias` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dek` to the `messages` table without a default value. This is not possible if the table is not empty.
  - Added the required column `dek_version_code` to the `messages` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "message_mappings" DROP CONSTRAINT "message_mappings_user_id_fkey";

-- DropForeignKey
ALTER TABLE "voice_call_sessions" DROP CONSTRAINT "voice_call_sessions_callee_user_id_fkey";

-- DropForeignKey
ALTER TABLE "voice_call_sessions" DROP CONSTRAINT "voice_call_sessions_caller_user_id_fkey";

-- DropForeignKey
ALTER TABLE "voice_call_sessions" DROP CONSTRAINT "voice_call_sessions_direct_chat_id_fkey";

-- DropIndex
DROP INDEX "message_mappings_user_id_idx";

-- DropIndex
DROP INDEX "message_mappings_user_id_key";

-- AlterTable
ALTER TABLE "message_mappings" DROP COLUMN "user_id",
ADD COLUMN     "dek" VARCHAR(128) NOT NULL,
ADD COLUMN     "version_code" VARCHAR(128) NOT NULL,
ALTER COLUMN "mappings" SET NOT NULL;

-- AlterTable
ALTER TABLE "message_medias" ADD COLUMN     "ai_confidence_score" DOUBLE PRECISION,
ADD COLUMN     "ai_generated_alt_text" TEXT,
ADD COLUMN     "alt_text" TEXT,
ADD COLUMN     "audio_duration" INTEGER,
ADD COLUMN     "auth_tag" VARCHAR(128) NOT NULL,
ADD COLUMN     "dek" VARCHAR(128) NOT NULL,
ADD COLUMN     "dek_version_code" VARCHAR(128) NOT NULL,
ADD COLUMN     "detected_objects" TEXT,
ADD COLUMN     "file_type" TEXT NOT NULL,
ADD COLUMN     "is_alt_text_validated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "iv" VARCHAR(128) NOT NULL,
ADD COLUMN     "transcript" TEXT;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "dek" VARCHAR(128) NOT NULL,
ADD COLUMN     "dek_version_code" VARCHAR(128) NOT NULL;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "auto_read_messages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "speech_rate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "stt_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tts_enabled" BOOLEAN NOT NULL DEFAULT false;

-- DropTable
DROP TABLE "voice_call_sessions";

-- CreateTable
CREATE TABLE "call_sessions" (
    "id" UUID NOT NULL,
    "direct_chat_id" INTEGER,
    "caller_user_id" INTEGER NOT NULL,
    "callee_user_id" INTEGER NOT NULL,
    "status" TEXT DEFAULT 'REQUESTING',
    "isVideoCall" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "hangup_reason" TEXT,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "message_embeddings" (
    "id" SERIAL NOT NULL,
    "message_id" INTEGER NOT NULL,
    "embedding" vector(768) NOT NULL,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "message_embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_sessions_caller_user_id_idx" ON "call_sessions"("caller_user_id");

-- CreateIndex
CREATE INDEX "call_sessions_callee_user_id_idx" ON "call_sessions"("callee_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_embeddings_message_id_key" ON "message_embeddings"("message_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_mappings_version_code_key" ON "message_mappings"("version_code");

-- CreateIndex
CREATE INDEX "message_mappings_version_code_idx" ON "message_mappings"("version_code");

-- CreateIndex
CREATE INDEX "message_medias_url_idx" ON "message_medias"("url");

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_direct_chat_id_fkey" FOREIGN KEY ("direct_chat_id") REFERENCES "direct_chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_caller_user_id_fkey" FOREIGN KEY ("caller_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "call_sessions" ADD CONSTRAINT "call_sessions_callee_user_id_fkey" FOREIGN KEY ("callee_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "message_embeddings" ADD CONSTRAINT "message_embeddings_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
