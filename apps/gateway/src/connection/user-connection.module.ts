import { Module } from '@nestjs/common'
import { UserConnectionService } from './user-connection.service'

@Module({
  providers: [UserConnectionService],
  exports: [UserConnectionService],
})
export class UserConnectionModule {}
