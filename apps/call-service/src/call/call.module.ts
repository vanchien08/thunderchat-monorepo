import { Module } from '@nestjs/common'
import { CallGateway } from './call.gateway'
import { CallService } from './call.service'
import { CallConnectionService } from '@/connection/call-connection.service'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'
import { CallController } from './call.controller'

@Module({
  imports: [GrpcClientModule],
  controllers: [CallController],
  providers: [CallGateway, CallService, CallConnectionService],
})
export class CallGatewayModule {}
