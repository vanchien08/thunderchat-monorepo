-- CreateEnum
CREATE TYPE "public"."ReportedMessageType" AS ENUM ('TEXT', 'STICKER', 'IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "public"."FriendRequestsStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

CREATE EXTENSION IF NOT EXISTS vector;
-- CreateEnum
CREATE TYPE "public"."MessageStatusEnum" AS ENUM ('SENT', 'SEEN');

-- CreateEnum
CREATE TYPE "public"."MessageType" AS ENUM ('TEXT', 'STICKER', 'MEDIA', 'PIN_NOTICE', 'NOTIFY');

-- CreateEnum
CREATE TYPE "public"."GroupChatRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "public"."AppRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "public"."ReportCategory" AS ENUM ('SENSITIVE_CONTENT', 'BOTHER', 'FRAUD', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('PENDING', 'RESOLVED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "public"."ViolationActionType" AS ENUM ('WARNING', 'TEMPORARY_BAN', 'PERMANENT_BAN');

-- CreateEnum
CREATE TYPE "public"."MessageMediaType" AS ENUM ('IMAGE', 'VIDEO', 'AUDIO', 'DOCUMENT');

-- CreateEnum
CREATE TYPE "public"."JoinRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "public"."message_mappings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "mappings" TEXT,
    "key" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."blocked_users" (
    "id" SERIAL NOT NULL,
    "blocker_user_id" INTEGER NOT NULL,
    "blocked_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "group_chat_id" INTEGER,
    CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "public"."AppRole" NOT NULL DEFAULT 'USER',
    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."profiles" (
    "id" SERIAL NOT NULL,
    "full_name" VARCHAR(255) NOT NULL,
    "birthday" DATE,
    "about" TEXT,
    "avatar" TEXT,
    "user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."direct_chats" (
    "id" SERIAL NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_message_id" INTEGER,
    CONSTRAINT "direct_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pinned_chats" (
    "id" SERIAL NOT NULL,
    "direct_chat_id" INTEGER,
    "group_chat_id" INTEGER,
    "pinned_by" INTEGER NOT NULL,
    "pinned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pinned_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."messages" (
    "id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "author_id" INTEGER NOT NULL,
    "recipient_id" INTEGER,
    "direct_chat_id" INTEGER,
    "group_chat_id" INTEGER,
    "type" "public"."MessageType" NOT NULL DEFAULT 'TEXT',
    "status" "public"."MessageStatusEnum" NOT NULL,
    "sticker_id" INTEGER,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reply_to_id" INTEGER,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,
    "is_violated" BOOLEAN NOT NULL DEFAULT false,
    "media_id" INTEGER,
    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."message_medias" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "thumbnail_url" TEXT NOT NULL,
    "type" "public"."MessageMediaType" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "message_medias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."pinned_messages" (
    "id" SERIAL NOT NULL,
    "message_id" INTEGER NOT NULL,
    "direct_chat_id" INTEGER,
    "group_chat_id" INTEGER,
    "pinned_by" INTEGER NOT NULL,
    "pinned_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "pinned_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."friends" (
    "id" SERIAL NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "friends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."friend_requests" (
    "id" SERIAL NOT NULL,
    "sender_id" INTEGER NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "status" "public"."FriendRequestsStatus" NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."stickers" (
    "id" SERIAL NOT NULL,
    "sticker_name" VARCHAR(50) NOT NULL,
    "image_url" VARCHAR(255) NOT NULL,
    "category_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "stickers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sticker_categories" (
    "id" SERIAL NOT NULL,
    "id_name" VARCHAR(255) NOT NULL,
    "thumbnail_url" VARCHAR(255) NOT NULL,
    "name" VARCHAR(50) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sticker_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_chat_permissions" (
    "id" SERIAL NOT NULL,
    "group_chat_id" INTEGER NOT NULL,
    "send_message" BOOLEAN NOT NULL DEFAULT true,
    "pin_message" BOOLEAN NOT NULL DEFAULT true,
    "share_invite_code" BOOLEAN NOT NULL DEFAULT true,
    "update_info" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "group_chat_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_chats" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "creator_id" INTEGER NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_sent_message_id" INTEGER,
    "invite_code" TEXT,
    CONSTRAINT "group_chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_join_requests" (
    "id" SERIAL NOT NULL,
    "group_chat_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "status" "public"."JoinRequestStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "group_join_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."group_chat_members" (
    "id" SERIAL NOT NULL,
    "group_chat_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "joined_by" INTEGER NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "role" "public"."GroupChatRole" NOT NULL DEFAULT 'MEMBER',
    CONSTRAINT "group_chat_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."user_settings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "only_receive_friend_message" BOOLEAN NOT NULL DEFAULT false,
    "push_notification_enabled" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "user_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."violation_reports" (
    "id" SERIAL NOT NULL,
    "reporter_user_id" INTEGER NOT NULL,
    "reported_user_id" INTEGER NOT NULL,
    "report_category" "public"."ReportCategory" NOT NULL,
    "reason_text" TEXT,
    "report_status" "public"."ReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "violation_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_images" (
    "id" SERIAL NOT NULL,
    "report_id" INTEGER NOT NULL,
    "image_url" TEXT NOT NULL,
    CONSTRAINT "report_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."violation_actions" (
    "id" SERIAL NOT NULL,
    "action_reason" TEXT NOT NULL,
    "action_type" "public"."ViolationActionType" NOT NULL,
    "banned_until" TIMESTAMP(3),
    "report_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "violation_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reported_messages" (
    "id" SERIAL NOT NULL,
    "message_id" INTEGER NOT NULL,
    "message_type" "public"."ReportedMessageType" NOT NULL,
    "message_content" TEXT NOT NULL,
    "report_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reported_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."push_notification_subscriptions" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "endpoint" TEXT NOT NULL,
    "p256dh" TEXT NOT NULL,
    "auth" TEXT NOT NULL,
    "expiration_time" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "push_notification_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."voice_call_sessions" (
    "id" UUID NOT NULL,
    "direct_chat_id" INTEGER,
    "caller_user_id" INTEGER NOT NULL,
    "callee_user_id" INTEGER NOT NULL,
    "status" TEXT DEFAULT 'REQUESTING',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ(3),
    "hangup_reason" TEXT,
    CONSTRAINT "voice_call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "message_mappings_user_id_key" ON "public"."message_mappings" ("user_id");

-- CreateIndex
CREATE INDEX "message_mappings_user_id_idx" ON "public"."message_mappings" ("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users" ("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users" ("email");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_user_id_key" ON "public"."profiles" ("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "direct_chats_last_sent_message_id_key" ON "public"."direct_chats" ("last_sent_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "direct_chats_creator_id_recipient_id_key" ON "public"."direct_chats" ("creator_id", "recipient_id");

-- CreateIndex
CREATE UNIQUE INDEX "message_medias_url_key" ON "public"."message_medias" ("url");

-- CreateIndex
CREATE UNIQUE INDEX "stickers_image_url_key" ON "public"."stickers" ("image_url");

-- CreateIndex
CREATE UNIQUE INDEX "sticker_categories_id_name_key" ON "public"."sticker_categories" ("id_name");

-- CreateIndex
CREATE UNIQUE INDEX "sticker_categories_thumbnail_url_key" ON "public"."sticker_categories" ("thumbnail_url");

-- CreateIndex
CREATE INDEX "sticker_categories_id_name_idx" ON "public"."sticker_categories" ("id_name");

-- CreateIndex
CREATE UNIQUE INDEX "group_chat_permissions_group_chat_id_key" ON "public"."group_chat_permissions" ("group_chat_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_chats_last_sent_message_id_key" ON "public"."group_chats" ("last_sent_message_id");

-- CreateIndex
CREATE UNIQUE INDEX "group_chats_invite_code_key" ON "public"."group_chats" ("invite_code");

-- CreateIndex
CREATE UNIQUE INDEX "group_chat_members_group_chat_id_user_id_key" ON "public"."group_chat_members" ("group_chat_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_settings_user_id_key" ON "public"."user_settings" ("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "violation_actions_report_id_key" ON "public"."violation_actions" ("report_id");

-- CreateIndex
CREATE UNIQUE INDEX "push_notification_subscriptions_endpoint_key" ON "public"."push_notification_subscriptions" ("endpoint");

-- CreateIndex
CREATE INDEX "push_notification_subscriptions_user_id_idx" ON "public"."push_notification_subscriptions" ("user_id");

-- CreateIndex
CREATE INDEX "voice_call_sessions_caller_user_id_idx" ON "public"."voice_call_sessions" ("caller_user_id");

-- CreateIndex
CREATE INDEX "voice_call_sessions_callee_user_id_idx" ON "public"."voice_call_sessions" ("callee_user_id");

-- AddForeignKey
ALTER TABLE "public"."message_mappings"
ADD CONSTRAINT "message_mappings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."blocked_users"
ADD CONSTRAINT "blocked_users_blocked_user_id_fkey" FOREIGN KEY ("blocked_user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."blocked_users"
ADD CONSTRAINT "blocked_users_blocker_user_id_fkey" FOREIGN KEY ("blocker_user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."blocked_users"
ADD CONSTRAINT "blocked_users_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "public"."group_chats" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."profiles"
ADD CONSTRAINT "profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direct_chats"
ADD CONSTRAINT "direct_chats_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direct_chats"
ADD CONSTRAINT "direct_chats_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."direct_chats"
ADD CONSTRAINT "direct_chats_last_sent_message_id_fkey" FOREIGN KEY ("last_sent_message_id") REFERENCES "public"."messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_chats"
ADD CONSTRAINT "pinned_chats_direct_chat_id_fkey" FOREIGN KEY ("direct_chat_id") REFERENCES "public"."direct_chats" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_chats"
ADD CONSTRAINT "pinned_chats_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "public"."group_chats" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_chats"
ADD CONSTRAINT "pinned_chats_pinned_by_fkey" FOREIGN KEY ("pinned_by") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages"
ADD CONSTRAINT "messages_direct_chat_id_fkey" FOREIGN KEY ("direct_chat_id") REFERENCES "public"."direct_chats" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages"
ADD CONSTRAINT "messages_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages"
ADD CONSTRAINT "messages_sticker_id_fkey" FOREIGN KEY ("sticker_id") REFERENCES "public"."stickers" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages"
ADD CONSTRAINT "messages_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages"
ADD CONSTRAINT "messages_reply_to_id_fkey" FOREIGN KEY ("reply_to_id") REFERENCES "public"."messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages"
ADD CONSTRAINT "messages_media_id_fkey" FOREIGN KEY ("media_id") REFERENCES "public"."message_medias" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."messages"
ADD CONSTRAINT "messages_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "public"."group_chats" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_messages"
ADD CONSTRAINT "pinned_messages_direct_chat_id_fkey" FOREIGN KEY ("direct_chat_id") REFERENCES "public"."direct_chats" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_messages"
ADD CONSTRAINT "pinned_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_messages"
ADD CONSTRAINT "pinned_messages_pinned_by_fkey" FOREIGN KEY ("pinned_by") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."pinned_messages"
ADD CONSTRAINT "pinned_messages_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "public"."group_chats" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friends"
ADD CONSTRAINT "friends_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friends"
ADD CONSTRAINT "friends_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friend_requests"
ADD CONSTRAINT "friend_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."friend_requests"
ADD CONSTRAINT "friend_requests_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."stickers"
ADD CONSTRAINT "stickers_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "public"."sticker_categories" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_chat_permissions"
ADD CONSTRAINT "group_chat_permissions_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "public"."group_chats" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_chats"
ADD CONSTRAINT "group_chats_creator_id_fkey" FOREIGN KEY ("creator_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_chats"
ADD CONSTRAINT "group_chats_last_sent_message_id_fkey" FOREIGN KEY ("last_sent_message_id") REFERENCES "public"."messages" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_join_requests"
ADD CONSTRAINT "group_join_requests_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "public"."group_chats" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_join_requests"
ADD CONSTRAINT "group_join_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_chat_members"
ADD CONSTRAINT "group_chat_members_group_chat_id_fkey" FOREIGN KEY ("group_chat_id") REFERENCES "public"."group_chats" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_chat_members"
ADD CONSTRAINT "group_chat_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."group_chat_members"
ADD CONSTRAINT "group_chat_members_joined_by_fkey" FOREIGN KEY ("joined_by") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."user_settings"
ADD CONSTRAINT "user_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."violation_reports"
ADD CONSTRAINT "violation_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."violation_reports"
ADD CONSTRAINT "violation_reports_reported_user_id_fkey" FOREIGN KEY ("reported_user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_images"
ADD CONSTRAINT "report_images_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."violation_reports" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."violation_actions"
ADD CONSTRAINT "violation_actions_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."violation_reports" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reported_messages"
ADD CONSTRAINT "reported_messages_message_id_fkey" FOREIGN KEY ("message_id") REFERENCES "public"."messages" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reported_messages"
ADD CONSTRAINT "reported_messages_report_id_fkey" FOREIGN KEY ("report_id") REFERENCES "public"."violation_reports" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."push_notification_subscriptions"
ADD CONSTRAINT "push_notification_subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_call_sessions"
ADD CONSTRAINT "voice_call_sessions_direct_chat_id_fkey" FOREIGN KEY ("direct_chat_id") REFERENCES "public"."direct_chats" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_call_sessions"
ADD CONSTRAINT "voice_call_sessions_caller_user_id_fkey" FOREIGN KEY ("caller_user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."voice_call_sessions"
ADD CONSTRAINT "voice_call_sessions_callee_user_id_fkey" FOREIGN KEY ("callee_user_id") REFERENCES "public"."users" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;