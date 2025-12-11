import { Module } from '@nestjs/common'
import { ClientsModule } from '@nestjs/microservices'
import { GrpcClientConfig } from './grpc-client.config'

@Module({
  imports: [ClientsModule.registerAsync([GrpcClientConfig.getAuthClient()])],
  exports: [ClientsModule],
})
export class GrpcClientModule {}
