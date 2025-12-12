import { Module } from '@nestjs/common'
import { StickersService } from './stickers.service'
import { StickerController } from './stickers.controller'

@Module({
  controllers: [StickerController],
  providers: [StickersService],
})
export class StickersModule {}
