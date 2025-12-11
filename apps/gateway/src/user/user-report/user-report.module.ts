import { Module } from '@nestjs/common'
import { UserReportController } from './user-report.controller'
import { UserReportService } from './user-report.service'
import { UserReportExceptionFilter } from './user-report.exception-filter'
import { UploadModule } from '@/upload/upload.module'
import { AuthModule } from '@/auth/auth.module'
import { UserModule } from '@/user/user.module'

@Module({
  imports: [UploadModule, AuthModule, UserModule],
  controllers: [UserReportController],
  providers: [UserReportService, UserReportExceptionFilter],
  exports: [UserReportService],
})
export class UserReportModule {}
