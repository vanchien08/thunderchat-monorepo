import { Module } from '@nestjs/common'
import { ClientsModule } from '@nestjs/microservices'
import { GrpcClientConfig } from './grpc-client.config'

@Module({
  imports: [
    ClientsModule.registerAsync([
      GrpcClientConfig.getFriendClient(),
      GrpcClientConfig.getConversationClient(),
      GrpcClientConfig.getAuthClient(),
      GrpcClientConfig.getUserClient(),
      GrpcClientConfig.getNotificationClient(),
      GrpcClientConfig.getSearchClient(),
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientModule {}
