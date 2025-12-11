-- AlterTable
ALTER TABLE "message_medias" ADD COLUMN     "ai_confidence_score" DOUBLE PRECISION,
ADD COLUMN     "ai_generated_alt_text" TEXT,
ADD COLUMN     "alt_text" TEXT,
ADD COLUMN     "audio_duration" INTEGER,
ADD COLUMN     "detected_objects" TEXT,
ADD COLUMN     "is_alt_text_validated" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "transcript" TEXT;

-- AlterTable
ALTER TABLE "user_settings" ADD COLUMN     "auto_read_messages" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "speech_rate" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
ADD COLUMN     "stt_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tts_enabled" BOOLEAN NOT NULL DEFAULT false;

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
CREATE UNIQUE INDEX "message_embeddings_message_id_key" ON "message_embeddings"("message_id");

-- AddForeignKey
ALTER TABLE "message_embeddings" ADD CONSTRAINT "message_embeddings_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
