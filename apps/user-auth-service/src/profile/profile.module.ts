import { Module } from '@nestjs/common'
import { ProfileController } from './profile.controller'
import { ProfileService } from './profile.service'
import { GrpcClientModule } from '@/configs/communication/grpc/grpc-client.module'

@Module({
  imports: [GrpcClientModule],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
