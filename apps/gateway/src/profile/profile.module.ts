import { Module } from '@nestjs/common'
import { ProfileController } from './profile.controller'
import { ProfileService } from './profile.service'
import { PrismaModule } from '../configs/db/prisma.module'
import { JwtModule } from '@nestjs/jwt'
import { UserModule } from '../user/user.module'
import { SyncDataToESModule } from '@/configs/elasticsearch/sync-data-to-ES/sync-data-to-ES.module'

@Module({
  imports: [
    PrismaModule, // Để inject PrismaService qua provider token
    JwtModule, // Để inject JWTService cho AuthGuard
    UserModule, // Để inject UserService cho AuthGuard
    SyncDataToESModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileService],
  exports: [ProfileService],
})
export class ProfileModule {}
