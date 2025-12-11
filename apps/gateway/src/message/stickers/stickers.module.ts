import { Module } from '@nestjs/common'
import { StickersService } from './stickers.service'
import { StickerController } from './stickers.controller'
import { UserModule } from '@/user/user.module'

@Module({
  imports: [UserModule],
  controllers: [StickerController],
  providers: [StickersService],
})
export class StickersModule {}
