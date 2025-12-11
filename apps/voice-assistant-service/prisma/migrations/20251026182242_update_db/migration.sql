/*
  Warnings:

  - You are about to drop the column `user_id` on the `message_mappings` table. All the data in the column will be lost.
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
ALTER TABLE "public"."message_mappings" DROP CONSTRAINT "message_mappings_user_id_fkey";

-- DropIndex
DROP INDEX "public"."message_mappings_user_id_idx";

-- DropIndex
DROP INDEX "public"."message_mappings_user_id_key";

-- AlterTable
ALTER TABLE "message_mappings" DROP COLUMN "user_id",
ADD COLUMN     "dek" VARCHAR(128) NOT NULL,
ADD COLUMN     "version_code" VARCHAR(128) NOT NULL,
ALTER COLUMN "mappings" SET NOT NULL;

-- AlterTable
ALTER TABLE "message_medias" ADD COLUMN     "auth_tag" VARCHAR(128) NOT NULL,
ADD COLUMN     "dek" VARCHAR(128) NOT NULL,
ADD COLUMN     "dek_version_code" VARCHAR(128) NOT NULL,
ADD COLUMN     "file_type" TEXT NOT NULL,
ADD COLUMN     "iv" VARCHAR(128) NOT NULL;

-- AlterTable
ALTER TABLE "messages" ADD COLUMN     "dek" VARCHAR(128) NOT NULL,
ADD COLUMN     "dek_version_code" VARCHAR(128) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "message_mappings_version_code_key" ON "message_mappings"("version_code");

-- CreateIndex
CREATE INDEX "message_mappings_version_code_idx" ON "message_mappings"("version_code");

-- CreateIndex
CREATE INDEX "message_medias_url_idx" ON "message_medias"("url");
