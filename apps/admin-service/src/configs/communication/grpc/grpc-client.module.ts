import { Module } from '@nestjs/common'
import { ClientsModule } from '@nestjs/microservices'
import { GrpcClientConfig } from './grpc-client.config'

@Module({
  imports: [
    ClientsModule.registerAsync([
      GrpcClientConfig.getUploadClient(),
      GrpcClientConfig.getUserConnectionClient(),
    ]),
  ],
  exports: [ClientsModule],
})
export class GrpcClientModule {}
