import { Module } from '@nestjs/common'
import { DeleteMessageController } from './delete-message.controller'
import { DeleteMessageService } from './delete-message.service'
import { UserConnectionModule } from '@/connection/user-connection.module'
import { PrismaService } from '@/configs/db/prisma.service'
import { AuthModule } from '@/auth/auth.module'
import { UserModule } from '@/user/user.module'
import { UploadService } from '@/upload/upload.service'
import { UploadModule } from '@/upload/upload.module'
import { SyncDataToESModule } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.module'

@Module({
  imports: [UserConnectionModule, AuthModule, UserModule, UploadModule, SyncDataToESModule],
  controllers: [DeleteMessageController],
  providers: [DeleteMessageService, PrismaService, UploadService],
})
export class DeleteMessageModule {}
