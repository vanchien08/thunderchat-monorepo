import { Module } from '@nestjs/common'
import { ClientsModule } from '@nestjs/microservices'
import { GrpcClientConfig } from './grpc-client.config'

@Module({
  imports: [
    ClientsModule.register([
      GrpcClientConfig.getFriendClient(),
      GrpcClientConfig.getConversationClient(),
      GrpcClientConfig.getAuthClient(),
      GrpcClientConfig.getUserClient(),
      GrpcClientConfig.getNotificationClient(),
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientModule {}
