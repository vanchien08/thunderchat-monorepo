import { Module } from '@nestjs/common'
import { AdminController } from './admin.controller'
import { AdminService } from './admin.service'
import { AdminExceptionFilter } from './admin.exception-filter'
import { PrismaModule } from '@/configs/db/prisma.module'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'

@Module({
  imports: [PrismaModule, GrpcClientModule],
  controllers: [AdminController],
  providers: [AdminService, AdminExceptionFilter],
  exports: [AdminService],
})
export class AdminModule {}
