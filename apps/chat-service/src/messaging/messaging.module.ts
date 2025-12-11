import { Module } from '@nestjs/common'
import { MessagingGateway } from './messaging.gateway'
import { UserConnectionModule } from '../connection/user-connection.module'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'

@Module({
  imports: [UserConnectionModule, GrpcClientModule],
  providers: [MessagingGateway],
})
export class MessagingGatewayModule {}
