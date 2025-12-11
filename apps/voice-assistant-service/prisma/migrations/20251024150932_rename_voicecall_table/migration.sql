/*
  Warnings:

  - You are about to drop the `voice_call_sessions` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."voice_call_sessions" DROP CONSTRAINT "voice_call_sessions_callee_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."voice_call_sessions" DROP CONSTRAINT "voice_call_sessions_caller_user_id_fkey";

-- DropForeignKey
ALTER TABLE "public"."voice_call_sessions" DROP CONSTRAINT "voice_call_sessions_direct_chat_id_fkey";

-- DropTable
DROP TABLE "public"."voice_call_sessions";

-- CreateTable
CREATE TABLE "public"."call_sessions" (
    "id" UUID NOT NULL,
    "direct_chat_id" INTEGER,
    "caller_user_id" INTEGER NOT NULL,
    "callee_user_id" INTEGER NOT NULL,
    "status" TEXT DEFAULT 'REQUESTING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "hangup_reason" TEXT,

    CONSTRAINT "call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "call_sessions_caller_user_id_idx" ON "public"."call_sessions"("caller_user_id");

-- CreateIndex
CREATE INDEX "call_sessions_callee_user_id_idx" ON "public"."call_sessions"("callee_user_id");

-- AddForeignKey
ALTER TABLE "public"."call_sessions" ADD CONSTRAINT "call_sessions_direct_chat_id_fkey" FOREIGN KEY ("direct_chat_id") REFERENCES "public"."direct_chats"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."call_sessions" ADD CONSTRAINT "call_sessions_caller_user_id_fkey" FOREIGN KEY ("caller_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."call_sessions" ADD CONSTRAINT "call_sessions_callee_user_id_fkey" FOREIGN KEY ("callee_user_id") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
