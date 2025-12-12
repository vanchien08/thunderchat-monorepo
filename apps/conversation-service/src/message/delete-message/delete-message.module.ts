import { Module } from '@nestjs/common'
import { DeleteMessageController } from './delete-message.controller'
import { DeleteMessageService } from './delete-message.service'
import { PrismaService } from '@/configs/db/prisma.service'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'

@Module({
  imports: [GrpcClientModule],
  controllers: [DeleteMessageController],
  providers: [DeleteMessageService, PrismaService],
})
export class DeleteMessageModule {}
