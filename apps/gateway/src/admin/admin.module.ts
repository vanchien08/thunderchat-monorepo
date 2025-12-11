import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminExceptionFilter } from './admin.exception-filter'
import { PrismaModule } from '@/configs/db/prisma.module'
import { UserModule } from '@/user/user.module'
import { UserConnectionModule } from '@/connection/user-connection.module'
import { UploadModule } from '@/upload/upload.module'

@Module({
  imports: [PrismaModule, UserModule, UserConnectionModule, UploadModule],
  controllers: [AdminController],
  providers: [AdminService, AdminExceptionFilter],
  exports: [AdminService],
})
export class AdminModule {}
