import { Module } from '@nestjs/common'
import { UserConnectionService } from './user-connection.service'
import { UserConnectionGrpcController } from './user-connection-grpc.controller'

@Module({
  controllers: [UserConnectionGrpcController],
  providers: [UserConnectionService],
  exports: [UserConnectionService],
})
export class UserConnectionModule {}
