import { Module } from '@nestjs/common'
import { UserReportController } from './user-report.controller'
import { UserReportService } from './user-report.service'
import { UserReportExceptionFilter } from './user-report.exception-filter'
import { UserModule } from '@/user/user.module'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'

@Module({
  imports: [UserModule, GrpcClientModule],
  controllers: [UserReportController],
  providers: [UserReportService, UserReportExceptionFilter],
  exports: [UserReportService],
})
export class UserReportModule {}
