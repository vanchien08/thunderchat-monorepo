import { Module } from '@nestjs/common';
import { ClientsModule } from '@nestjs/microservices';
import { GrpcClientConfig } from './grpc-client.config';

@Module({
  imports: [
    ClientsModule.register([
      GrpcClientConfig.getChatClient(),
      GrpcClientConfig.getConversationClient(),
      GrpcClientConfig.getUserClient(),
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientModule {}
