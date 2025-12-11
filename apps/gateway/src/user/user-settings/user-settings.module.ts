import { Module } from '@nestjs/common'
import { UserSettingsService } from './user-settings.service'
import { UserSettingsController } from './user-settings.controller'
import { AuthModule } from '../../auth/auth.module'
import { UserModule } from '../user.module'

@Module({
  imports: [AuthModule, UserModule],
  providers: [UserSettingsService],
  controllers: [UserSettingsController],
  exports: [UserSettingsService],
})
export class UserSettingsModule {}
